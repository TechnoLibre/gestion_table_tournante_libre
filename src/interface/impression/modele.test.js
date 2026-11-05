// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de l'aperçu avant impression (§ 11.7, § 8.5, § 18.6), sans DOM :
// les options d'une vue, la feuille et son pied, la bande mesurée, les pages
// nommées de la feuille d'impression et le filigrane. Les libellés que le
// modèle désigne existent, en français comme en langue témoin.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { etatPlaces } from '../../application/places.js';
import { MARQUE_TEMOIN, creerTraduction } from '../../application/traduction.js';
import { constante } from '../../geometrie/constantes.js';
import { PAPIERS } from '../../geometrie/papiers.js';
import { texteLivre } from '../../demo/livrees.js';
import { ErreurCommande } from '../../application/erreurs.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  MM_PAR_PX,
  PAPIERS_OFFERTS,
  bandeDeFeuille,
  clesPapier,
  cleDecoupe,
  cleTri,
  cleVue,
  dimensionsPage,
  feuilleDe,
  filigraneDe,
  hauteurContenu,
  nomPage,
  optionsApercu,
  refusApercu,
  sortieApercu,
  toursOfferts,
} from './modele.js';

const APERCU = Object.freeze({
  vue: 'plan',
  tour: 2,
  listes: true,
  organisations: true,
  decoupe: 'auto',
  parColonne: true,
  parTour: false,
  dessinTable: false,
  tri: 'organisation',
});
const PIED = Object.freeze({ nom: 'Soirée des Merles', date: '2026-10-09', tour: 2, horodatage: '2026-10-09T19:00:00-04:00', version: 'v' });

const petite = () => analyser(texteLivre('petite')).charge;

// La petite démonstration et une proposition écrite à la main, d'un seul
// tour répété : chaque table garde ses trois personnes.
function avecProposition() {
  const charge = structuredClone(petite());
  const tables = charge.tables.map(({ id }) => id);
  const sieges = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]];
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 300,
      historique: 1000,
      produitVersion: 'v',
      siegesAttribues: false,
      tables,
      capacites: tables.map(() => 3),
      tours: charge.evenement.tours,
      participants: sieges.flat(),
      placement: Array.from({ length: charge.evenement.tours }, () => ({ sieges: sieges.map((s) => [...s]), reserve: [] })),
    },
  ];
  charge.prochainsIds.proposition = 2;
  return charge;
}

describe('optionsApercu : ce que l’aperçu imprime', () => {
  test('le plan : son tour, ses listes et leurs organisations, sa découpe et une colonne par page ; l’orientation, celle que la découpe choisira (null)', () => {
    assert.deepEqual(optionsApercu(APERCU, 'A4'), {
      vue: 'plan', papier: 'A4', orientation: null, tour: 2, listes: true, organisations: true,
      decoupe: 'auto', parColonne: true, parTour: false, dessinTable: false, tri: 'organisation', question: false,
    });
    const sans = optionsApercu({ ...APERCU, organisations: false, parColonne: false }, 'A4');
    assert.deepEqual([sans.organisations, sans.parColonne], [false, false]);
  });

  test('les listes s’impriment en portrait et couvrent la soirée, quel que soit le tour du plan ; la feuille par tour, le dessin de la table et le tri rendus tels quels', () => {
    for (const vue of ['accueil', 'tables']) {
      const options = optionsApercu({ ...APERCU, vue, parTour: true, dessinTable: true, tri: 'prenom' }, 'Lettre');
      assert.equal(options.tri, 'prenom', vue);
      assert.equal(options.orientation, 'portrait', vue);
      assert.equal(options.tour, 'tous', vue);
      assert.equal(options.papier, 'Lettre', vue);
      assert.equal(options.parTour, true, vue);
      assert.equal(options.dessinTable, true, vue);
    }
  });

  test('sans papier choisi, l’aperçu pose la question : question vraie, papier null', () => {
    const options = optionsApercu(APERCU, null);
    assert.equal(options.question, true);
    assert.equal(options.papier, null);
    assert.equal(optionsApercu(APERCU, 'A4').question, false);
  });

  test('un aperçu fermé, une vue ou un papier hors du domaine lèvent', () => {
    assert.throws(() => optionsApercu(null, 'A4'), TypeError);
    assert.throws(() => optionsApercu({ ...APERCU, vue: 'badges' }, 'A4'), RangeError);
    assert.throws(() => optionsApercu(APERCU, 'A3'), RangeError);
  });
});

describe('les tours que le plan imprimé offre', () => {
  test('de 1 au nombre de tours de la soirée, dans l’ordre ; un nombre hors du domaine lève', () => {
    assert.deepEqual(toursOfferts(4), [1, 2, 3, 4]);
    assert.deepEqual(toursOfferts(1), [1]);
    for (const faute of [0, 1.5, Number.NaN, '3']) assert.throws(() => toursOfferts(faute), RangeError, String(faute));
  });
});

describe('les dimensions d’une page (§ 11.2, § 11.7)', () => {
  test('A4 et Lettre, portrait et paysage, en mm, tirés de PAPIERS', () => {
    assert.deepEqual(dimensionsPage('A4', 'portrait'), { largeur: 210, hauteur: 297 });
    assert.deepEqual(dimensionsPage('A4', 'paysage'), { largeur: 297, hauteur: 210 });
    assert.deepEqual(dimensionsPage('Lettre', 'portrait'), { largeur: 215.9, hauteur: 279.4 });
    assert.deepEqual(dimensionsPage('Lettre', 'paysage'), { largeur: 279.4, hauteur: 215.9 });
    assert.throws(() => dimensionsPage('A3', 'portrait'), RangeError);
    assert.throws(() => dimensionsPage('A4', 'carre'), RangeError);
  });

  test('les papiers offerts sont les clés de PAPIERS, chacun nommé et décrit par sa table', () => {
    assert.deepEqual(PAPIERS_OFFERTS, Object.keys(PAPIERS));
    assert.deepEqual(clesPapier('A4'), { nom: 'impression.papier.nom.a4', choix: 'impression.papier.choix.a4' });
    assert.deepEqual(clesPapier('Lettre'), { nom: 'impression.papier.nom.lettre', choix: 'impression.papier.choix.lettre' });
    assert.throws(() => clesPapier('A3'), RangeError);
  });

  test('la hauteur du contenu : la page, moins la marge de chaque bord, moins la bande mesurée', () => {
    assert.equal(hauteurContenu({ papier: 'A4', orientation: 'portrait', margeMm: 10, bandeMm: 7.5 }), 297 - 20 - 7.5);
    assert.equal(hauteurContenu({ papier: 'Lettre', orientation: 'paysage', margeMm: 10, bandeMm: 0 }), 215.9 - 20);
    assert.throws(() => hauteurContenu({ papier: 'A4', orientation: 'portrait', margeMm: 10, bandeMm: 277 }), RangeError);
    assert.throws(() => hauteurContenu({ papier: 'A4', orientation: 'portrait', margeMm: 10, bandeMm: -1 }), RangeError);
    assert.throws(() => hauteurContenu({ papier: 'A4', orientation: 'portrait', margeMm: 10, bandeMm: Number.NaN }), RangeError);
  });
});

describe('la bande mesurée (HAUTEUR_BANDE_IMPRESSION, § 14.1)', () => {
  test('ce que la feuille gabarit porte hors de son contenu, en mm : sa hauteur moins le contenu, moins les deux marges', () => {
    assert.equal(MM_PAR_PX, 25.4 / 96);
    const feuillePx = (20 + 12) / MM_PAR_PX;
    assert.ok(Math.abs(bandeDeFeuille({ feuillePx, contenuPx: 0, margeMm: 10 }) - 12) < 1e-9);
    const contenuPx = 50 / MM_PAR_PX;
    assert.ok(Math.abs(bandeDeFeuille({ feuillePx: feuillePx + contenuPx, contenuPx, margeMm: 10 }) - 12) < 1e-9);
  });

  test('une bande négative ou non finie lève : la feuille ne porte pas ses marges', () => {
    assert.throws(() => bandeDeFeuille({ feuillePx: 10, contenuPx: 0, margeMm: 10 }), RangeError);
    assert.throws(() => bandeDeFeuille({ feuillePx: Number.NaN, contenuPx: 0, margeMm: 10 }), RangeError);
  });

  test('la constante est mesurée à l’exécution, sans valeur au registre', () => {
    assert.equal(constante('HAUTEUR_BANDE_IMPRESSION'), null);
  });
});

describe('les pages nommées de la feuille d’impression (impression.css)', () => {
  const css = readFileSync(new URL('../impression.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const TAILLES = { A4: 'A4', Lettre: 'letter' };
  const SENS = { portrait: 'portrait', paysage: 'landscape' };

  test('une page nommée par papier et orientation, à la taille du papier, sans marge', () => {
    const noms = [];
    for (const papier of PAPIERS_OFFERTS) {
      for (const orientation of ['portrait', 'paysage']) {
        const nom = nomPage(papier, orientation);
        noms.push(nom);
        const regle = new RegExp(`@page\\s+${nom}\\s*\\{\\s*size:\\s*${TAILLES[papier]}\\s+${SENS[orientation]};\\s*margin:\\s*0;\\s*\\}`);
        assert.match(css, regle, nom);
      }
    }
    assert.equal(new Set(noms).size, 4);
    assert.throws(() => nomPage('A3', 'portrait'), RangeError);
  });

  test('le masquage d’impression est gardé par body:has([data-impression]) : hors de l’aperçu, rien n’est masqué', () => {
    const impression = css.slice(css.indexOf('@media print'));
    assert.ok(css.includes('@media print'));
    for (const masque of impression.matchAll(/([^{}]*)\{[^{}]*display:\s*none/g)) {
      assert.match(masque[1], /body:has\(\[data-impression\]\)/, masque[1].trim());
    }
  });
});

describe('feuilleDe : le pied de cinq éléments et le filigrane (§ 11.7, § 18.6)', () => {
  test('nom, date, tour, horodatage du placement, version, dans cet ordre ; le filigrane suit brouillon', () => {
    const feuille = feuilleDe(PIED, true);
    assert.deepEqual(feuille.elements.map(({ element }) => element), ['nom', 'date', 'tour', 'horodatage', 'version']);
    assert.deepEqual(feuille.elements[0], { element: 'nom', libelle: null, donnee: 'Soirée des Merles', forme: 'texte' });
    assert.deepEqual(feuille.elements[1], { element: 'date', libelle: null, donnee: '2026-10-09', forme: 'date' });
    assert.deepEqual(feuille.elements[2], { element: 'tour', libelle: { cle: 'impression.pied.tour', details: { tour: 2 } }, donnee: null, forme: 'texte' });
    assert.deepEqual(feuille.elements[3], {
      element: 'horodatage', libelle: { cle: 'impression.pied.placement', details: {} }, donnee: '2026-10-09T19:00:00-04:00', forme: 'horodatage',
    });
    assert.deepEqual(feuille.elements[4], { element: 'version', libelle: { cle: 'impression.pied.version', details: {} }, donnee: 'v', forme: 'texte' });
    assert.equal(feuille.filigrane, true);
    assert.equal(feuilleDe(PIED, false).filigrane, false);
  });

  test('sans date, sans horodatage, à « tous » : le libellé qui le dit, aucune donnée', () => {
    const { elements } = feuilleDe({ ...PIED, date: null, horodatage: null, tour: 'tous' }, false);
    assert.deepEqual(elements[1], { element: 'date', libelle: { cle: 'impression.pied.sansDate', details: {} }, donnee: null, forme: 'texte' });
    assert.deepEqual(elements[2], { element: 'tour', libelle: { cle: 'impression.pied.tousLesTours', details: {} }, donnee: null, forme: 'texte' });
    assert.deepEqual(elements[3], { element: 'horodatage', libelle: { cle: 'impression.pied.placementInconnu', details: {} }, donnee: null, forme: 'texte' });
  });

  test('un tour qui a un nom s’écrit par ce nom, une donnée sans libellé ; un tour sans nom garde son libellé', () => {
    const nomsTours = [null, 'Plat principal'];
    assert.deepEqual(feuilleDe(PIED, false, nomsTours).elements[2], { element: 'tour', libelle: null, donnee: 'Plat principal', forme: 'texte' });
    assert.deepEqual(feuilleDe({ ...PIED, tour: 1 }, false, nomsTours).elements[2], {
      element: 'tour', libelle: { cle: 'impression.pied.tour', details: { tour: 1 } }, donnee: null, forme: 'texte',
    });
    assert.equal(feuilleDe({ ...PIED, tour: 'tous' }, false, nomsTours).elements[2].libelle.cle, 'impression.pied.tousLesTours');
  });

  test('un pied hors du contrat, un brouillon qui n’est pas un booléen, lèvent', () => {
    assert.throws(() => feuilleDe({ ...PIED, tour: 0 }, false), TypeError);
    assert.throws(() => feuilleDe({ ...PIED, nom: 3 }, false), TypeError);
    assert.throws(() => feuilleDe(PIED, 'oui'), TypeError);
  });
});

describe('refusApercu : un nom d’événement au-delà de la borne ne s’imprime pas (§ 8.1, § 11.7)', () => {
  // Le refus attendu d'un nom de longueur donnée : le code, la longueur, la
  // borne, et le remède « Renommer ».
  function refusAttendu(refus, longueur) {
    assert.ok(refus instanceof ErreurCommande, `ErreurCommande attendue, reçu ${refus}`);
    assert.equal(refus.code, 'NOM_EVENEMENT_TROP_LONG');
    assert.deepEqual(refus.details, { longueur, maximum: 68, remede: { geste: 'renommer' } });
  }

  test('68 caractères s’impriment ; 69, le refus et son remède, sans troncature', () => {
    assert.equal(refusApercu({ ...PIED, nom: 'k'.repeat(68) }), null);
    assert.equal(refusApercu(PIED), null);
    refusAttendu(refusApercu({ ...PIED, nom: 'k'.repeat(69) }), 69);
  });

  test('un nom de 8 000 caractères lu d’un fichier : la charge s’ouvre, le pied se compose, l’aperçu rend le refus sans lever', () => {
    const long = 'Gala des Grèbes '.repeat(500);
    assert.equal(long.length, 8000);
    const ecrite = petite();
    ecrite.evenement.nom = long;
    const { charge } = analyser(serialiser(ecrite, { revision: 1, produitVersion: 'v' }));
    assert.equal(charge.evenement.nom, long);
    const pied = { ...PIED, nom: charge.evenement.nom };
    assert.equal(feuilleDe(pied, true).elements[0].donnee, long);
    refusAttendu(refusApercu(pied), long.trim().length);
  });

  test('un pied sans nom de texte est une faute du code', () => {
    assert.throws(() => refusApercu({ ...PIED, nom: 3 }), TypeError);
  });
});

describe('le filigrane BROUILLON (§ 11.7, § 14.5)', () => {
  test('centré sur la page, couché sur sa diagonale montante, d’un corps tiré de la diagonale', () => {
    for (const [papier, orientation] of [['A4', 'portrait'], ['A4', 'paysage'], ['Lettre', 'portrait']]) {
      const { largeur, hauteur } = dimensionsPage(papier, orientation);
      const f = filigraneDe(papier, orientation);
      assert.deepEqual([f.largeur, f.hauteur, f.x, f.y], [largeur, hauteur, largeur / 2, hauteur / 2], papier);
      assert.ok(Math.abs(f.angle + (Math.atan2(hauteur, largeur) * 180) / Math.PI) < 1e-9, `${papier} ${orientation}`);
      assert.ok(f.corps > 0 && f.corps < Math.hypot(largeur, hauteur) / 5, `${papier} ${orientation}`);
      assert.ok(f.trait > 0, 'contour non nul');
    }
  });
});

describe('la sortie de l’aperçu', () => {
  test('sans placement, la source des réservations, sans proposition ; le tour du plan borné aux tours de la soirée', () => {
    const charge = petite();
    const sortie = sortieApercu(charge, { tour: 9 }, null);
    assert.equal(sortie.source, 'reservations');
    assert.equal(sortie.proposition, null);
    assert.equal(sortie.tour, charge.evenement.tours);
    assert.deepEqual(sortie.etat, etatPlaces(charge, { tour: charge.evenement.tours }));
    assert.equal(sortieApercu(charge, { tour: 'tous' }, null).tour, 'tous');
  });

  test('une proposition montrée est la source de la sortie, par son identifiant', () => {
    const sortie = sortieApercu(avecProposition(), { tour: 1 }, 1);
    assert.deepEqual([sortie.source, sortie.proposition, sortie.tour], ['proposition', 1, 1]);
  });
});

describe('la découpe du plan : une seule implémentation (§ 13.2)', () => {
  test('le modèle de l’aperçu ne découpe pas le plan : la vue du plan passe par pagesDuPlan (plan.js) seule', () => {
    // Un second appelant de decouperPlan découperait le même plan sur
    // d'autres géométries ou sans les listes, et deux aperçus d'un même
    // état ne compteraient plus les mêmes pages. Le texte du module, sans
    // ses commentaires, n'importe ni la découpe ni l'englobant d'impression.
    const source = readFileSync(new URL('./modele.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.doesNotMatch(source, /geometrie\/pages\.js|\bdecouperPlan\b|\benglobantImpression\b/);
  });
});

describe('les libellés de l’aperçu (§ 14.6)', () => {
  const temoin = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE], { langue: 'temoin' }).t;
  const { ouverture, fermeture } = MARQUE_TEMOIN;

  test('chaque clé que le modèle désigne existe et se marque en langue témoin', () => {
    const cles = [
      ...['plan', 'accueil', 'tables'].map(cleVue),
      ...['auto', 'unePage', 'decoupe'].map(cleDecoupe),
      ...['organisation', 'nom', 'prenom'].map(cleTri),
      ...PAPIERS_OFFERTS.flatMap((papier) => Object.values(clesPapier(papier))),
      ...[feuilleDe(PIED, true), feuilleDe({ ...PIED, date: null, horodatage: null, tour: 'tous' }, false)].flatMap(({ elements }) =>
        elements.filter(({ libelle }) => libelle !== null).map(({ libelle }) => libelle.cle),
      ),
    ];
    assert.ok(cles.length >= 15);
    for (const cle of cles) {
      const texte = temoin(cle, { tour: 2 });
      assert.ok(texte.startsWith(ouverture) && texte.endsWith(fermeture), cle);
    }
    assert.throws(() => cleVue('badges'), RangeError);
    assert.throws(() => cleDecoupe('deux'), RangeError);
    assert.throws(() => cleTri('table'), RangeError);
  });
});
