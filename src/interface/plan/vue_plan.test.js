// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La vue du plan côté interface (§ 7.2, § 8.5, § 13.3) : le cadre lu d'un
// DOMRect, la vue d'ouverture — cadrage mémorisé borné au cadre, sinon
// l'ajustement —, la vue d'après un changement de cadre, les zooms de la
// molette et des boutons, l'englobant d'un tour, le tour montré et les noms.
// Les valeurs attendues viennent de src/geometrie/vue.js, la seule
// implémentation des conversions, sollicitée une seconde fois.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { etatPlaces } from '../../application/places.js';
import { englobant, geometrieTable } from '../../geometrie/tables.js';
import {
  FACTEUR_K_MIN,
  K_MAX,
  MARGE_AJUSTEMENT_PX,
  ajuster,
  bornesZoom,
  facteurMolette,
  kAjuste,
  zoomerSous,
} from '../../geometrie/vue.js';
import { creerCharge } from '../../stockage/document.js';
import {
  FACTEUR_BOUTON,
  appartenanceDeCharge,
  cadreDepuisRect,
  englobantDuTour,
  nomDeCharge,
  placerBulle,
  sourceMontree,
  tourAffiche,
  toursOfferts,
  vueApresCadre,
  vueInitiale,
  zoomerBouton,
  zoomerMolette,
} from './vue_plan.js';

// Quatre tables de 3 places, centres à 300 cm : l'emprise de chacune a un
// rayon de 79 cm.
const ENGLOBANT = { minX: -79, minY: -79, maxX: 379, maxY: 379 };
const CADRE = { gauche: 37, haut: 211, largeur: 1366, hauteur: 700 };
const PETIT = { gauche: 37, haut: 211, largeur: 683, hauteur: 700 };

const finie = (vue) => [vue.k, vue.tx, vue.ty].every(Number.isFinite) && vue.k > 0;

describe('cadreDepuisRect', () => {
  test('gauche ← left, haut ← top, largeur ← width, hauteur ← height', () => {
    assert.deepEqual(cadreDepuisRect({ left: 37, top: 211, width: 800, height: 600 }), {
      gauche: 37,
      haut: 211,
      largeur: 800,
      hauteur: 600,
    });
  });

  test('ne lit que ces quatre propriétés d’un DOMRect, x et y ignorés', () => {
    const rect = { x: 1, y: 2, left: 3, top: 4, right: 13, bottom: 24, width: 10, height: 20 };
    assert.deepEqual(cadreDepuisRect(rect), { gauche: 3, haut: 4, largeur: 10, hauteur: 20 });
  });
});

describe('vueInitiale (§ 7.2, § 8.5)', () => {
  test('sans cadrage : l’ajustement', () => {
    assert.deepEqual(vueInitiale(null, ENGLOBANT, CADRE), ajuster(ENGLOBANT, CADRE));
  });

  test('un cadrage dans les bornes du cadre est rendu tel quel', () => {
    const cadrage = { k: 1.3, tx: -40, ty: 25 };
    assert.deepEqual(vueInitiale(cadrage, ENGLOBANT, CADRE), cadrage);
  });

  test('un cadrage hors des bornes est ramené : sous k_min, au-dessus de 10', () => {
    const kMin = FACTEUR_K_MIN * kAjuste(ENGLOBANT, CADRE);
    const bas = vueInitiale({ k: kMin / 4, tx: 10, ty: 20 }, ENGLOBANT, CADRE);
    assert.equal(bas.k, kMin);
    const haut = vueInitiale({ k: 40, tx: 10, ty: 20 }, ENGLOBANT, CADRE);
    assert.equal(haut.k, K_MAX);
    assert.ok(finie(bas) && finie(haut));
  });

  test('ramené, le point de dessin au centre du cadre y reste', () => {
    const cadrage = { k: 40, tx: 10, ty: 20 };
    const vue = vueInitiale(cadrage, ENGLOBANT, CADRE);
    const centre = (v) => [(CADRE.largeur / 2 - v.tx) / v.k, (CADRE.hauteur / 2 - v.ty) / v.k];
    const [ax, ay] = centre(cadrage);
    const [bx, by] = centre(vue);
    assert.ok(Math.abs(ax - bx) < 1e-9 && Math.abs(ay - by) < 1e-9);
  });

  test('un cadrage restitué dans un cadre plus grand, où k_min monte, est relevé à k_min', () => {
    const kMinPetit = FACTEUR_K_MIN * kAjuste(ENGLOBANT, PETIT);
    const kMinGrand = FACTEUR_K_MIN * kAjuste(ENGLOBANT, CADRE);
    assert.ok(kMinPetit < kMinGrand);
    assert.equal(vueInitiale({ k: kMinPetit, tx: 0, ty: 0 }, ENGLOBANT, CADRE).k, kMinGrand);
  });

  test('cadre nul → null, avec ou sans cadrage', () => {
    const nul = { gauche: 0, haut: 0, largeur: 0, hauteur: 0 };
    assert.equal(vueInitiale(null, ENGLOBANT, nul), null);
    assert.equal(vueInitiale({ k: 1, tx: 0, ty: 0 }, ENGLOBANT, nul), null);
    assert.equal(vueInitiale(null, null, nul), null);
  });

  test('cadre de 20 × 20 → null, avec et sans cadrage ; 32 px de large aussi, 33 non', () => {
    const minuscule = { gauche: 5, haut: 5, largeur: 20, hauteur: 20 };
    assert.equal(vueInitiale(null, ENGLOBANT, minuscule), null);
    assert.equal(vueInitiale({ k: 1, tx: 0, ty: 0 }, ENGLOBANT, minuscule), null);
    const limite = 2 * MARGE_AJUSTEMENT_PX;
    assert.equal(vueInitiale(null, ENGLOBANT, { gauche: 0, haut: 0, largeur: limite, hauteur: 600 }), null);
    const etroit = vueInitiale(null, ENGLOBANT, { gauche: 0, haut: 0, largeur: limite + 1, hauteur: 600 });
    assert.ok(finie(etroit));
  });

  test('cadre de 33 × 600 → une vue aux trois nombres finis, k > 0', () => {
    const vue = vueInitiale(null, ENGLOBANT, { gauche: 0, haut: 0, largeur: 33, hauteur: 600 });
    assert.ok(finie(vue));
    const memorisee = vueInitiale({ k: 2, tx: 3, ty: 4 }, ENGLOBANT, { gauche: 0, haut: 0, largeur: 33, hauteur: 600 });
    assert.ok(finie(memorisee));
  });

  test('plan vide : k = 1, l’origine au centre du cadre ; un cadrage mémorisé se borne aussi', () => {
    assert.deepEqual(vueInitiale(null, null, CADRE), { k: 1, tx: CADRE.largeur / 2, ty: CADRE.hauteur / 2 });
    assert.equal(vueInitiale({ k: 0.1, tx: 0, ty: 0 }, null, CADRE).k, FACTEUR_K_MIN);
  });

  test('ne modifie pas le cadrage reçu', () => {
    const cadrage = Object.freeze({ k: 40, tx: 10, ty: 20 });
    vueInitiale(cadrage, ENGLOBANT, CADRE);
    assert.deepEqual(cadrage, { k: 40, tx: 10, ty: 20 });
  });
});

describe('vueApresCadre (§ 7.2)', () => {
  test('k gardé dans les bornes du nouveau cadre', () => {
    const kMinGrand = FACTEUR_K_MIN * kAjuste(ENGLOBANT, CADRE);
    const vue = { k: FACTEUR_K_MIN * kAjuste(ENGLOBANT, PETIT), tx: 5, ty: 6 };
    const apres = vueApresCadre(vue, ENGLOBANT, CADRE);
    assert.equal(apres.k, kMinGrand);
    const { kMin, kMax } = bornesZoom(kAjuste(ENGLOBANT, CADRE));
    assert.ok(apres.k >= kMin && apres.k <= kMax);
  });

  test('un k déjà dans les bornes : la même vue, tx et ty compris', () => {
    const vue = { k: 1, tx: 5, ty: 6 };
    assert.deepEqual(vueApresCadre(vue, ENGLOBANT, PETIT), vue);
  });

  test('cadre nul → la vue reçue, la même, sans lever', () => {
    const vue = { k: 1, tx: 5, ty: 6 };
    assert.equal(vueApresCadre(vue, ENGLOBANT, { gauche: 0, haut: 0, largeur: 0, hauteur: 0 }), vue);
  });

  test('cadre de 20 × 20 → la vue reçue, la même, sans lever', () => {
    const vue = { k: 1, tx: 5, ty: 6 };
    assert.equal(vueApresCadre(vue, ENGLOBANT, { gauche: 0, haut: 0, largeur: 20, hauteur: 20 }), vue);
  });
});

describe('les zooms de l’opérateur (§ 7.2)', () => {
  test('molette : zoomerSous au point du pointeur, du facteur de facteurMolette, aux bornes du cadre', () => {
    const vue = ajuster(ENGLOBANT, CADRE);
    const evenement = { clientX: 400, clientY: 300, deltaY: -100, deltaMode: 0 };
    const attendue = zoomerSous(vue, CADRE, 400, 300, facteurMolette(-100, 0), bornesZoom(kAjuste(ENGLOBANT, CADRE)));
    assert.deepEqual(zoomerMolette(vue, ENGLOBANT, CADRE, evenement), attendue);
  });

  test('molette : vingt crans vers l’arrière s’arrêtent à k_min, vingt vers l’avant à 10', () => {
    const depart = ajuster(ENGLOBANT, CADRE);
    let vue = depart;
    for (let i = 0; i < 20; i += 1) vue = zoomerMolette(vue, ENGLOBANT, CADRE, { clientX: 100, clientY: 100, deltaY: 100, deltaMode: 0 });
    assert.equal(vue.k, FACTEUR_K_MIN * kAjuste(ENGLOBANT, CADRE));
    for (let i = 0; i < 60; i += 1) vue = zoomerMolette(vue, ENGLOBANT, CADRE, { clientX: 100, clientY: 100, deltaY: -100, deltaMode: 0 });
    assert.equal(vue.k, K_MAX);
  });

  test('bouton : facteur 1,25 autour du centre du cadre, dans un sens et dans l’autre', () => {
    assert.equal(FACTEUR_BOUTON, 1.25);
    const vue = ajuster(ENGLOBANT, CADRE);
    const bornes = bornesZoom(kAjuste(ENGLOBANT, CADRE));
    const cx = CADRE.gauche + CADRE.largeur / 2;
    const cy = CADRE.haut + CADRE.hauteur / 2;
    assert.deepEqual(zoomerBouton(vue, ENGLOBANT, CADRE, 1), zoomerSous(vue, CADRE, cx, cy, 1.25, bornes));
    assert.deepEqual(zoomerBouton(vue, ENGLOBANT, CADRE, -1), zoomerSous(vue, CADRE, cx, cy, 1 / 1.25, bornes));
    assert.ok(zoomerBouton(vue, ENGLOBANT, CADRE, 1).k > vue.k);
    assert.ok(zoomerBouton(vue, ENGLOBANT, CADRE, -1).k < vue.k);
  });

  test('bouton : un sens qui n’est ni 1 ni -1 lève', () => {
    const vue = ajuster(ENGLOBANT, CADRE);
    assert.throws(() => zoomerBouton(vue, ENGLOBANT, CADRE, 0), RangeError);
    assert.throws(() => zoomerBouton(vue, ENGLOBANT, CADRE, 2), RangeError);
  });

  test('vue null ou cadre trop petit : null, rien à zoomer, sans lever', () => {
    const vue = { k: 1, tx: 0, ty: 0 };
    const minuscule = { gauche: 0, haut: 0, largeur: 20, hauteur: 20 };
    const molette = { clientX: 0, clientY: 0, deltaY: -100, deltaMode: 0 };
    assert.equal(zoomerMolette(null, ENGLOBANT, CADRE, molette), null);
    assert.equal(zoomerMolette(vue, ENGLOBANT, minuscule, molette), null);
    assert.equal(zoomerBouton(null, ENGLOBANT, CADRE, 1), null);
    assert.equal(zoomerBouton(vue, ENGLOBANT, minuscule, 1), null);
  });
});

// Une charge de deux tables, ronde de 6 et carrée de 5, et trois tours.
function chargeDEpreuve() {
  const charge = creerCharge({ id: 'epreuve-vue', nom: 'Club des Merles', siegesParDefaut: 6, tours: 3 });
  charge.tables = [
    { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
    { id: 2, numero: 2, sieges: 5, forme: 'carree', position: { x: 300, y: 120 } },
  ];
  charge.participants = [
    { id: 1, nom: 'Ombrelle', prenom: 'Iris', appartenance: null, courriel: null, titrePressenti: null, notes: null, exclu: false },
    { id: 2, nom: 'Grisaille', prenom: null, appartenance: null, courriel: null, titrePressenti: null, notes: null, exclu: false },
  ];
  return charge;
}

describe('l’englobant d’un tour, le tour montré, les noms', () => {
  test('englobantDuTour : celui des géométries des tables à leur capacité', () => {
    const charge = chargeDEpreuve();
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(etat.tables.length, 2);
    const attendu = englobant([geometrieTable(charge.tables[0], 6), geometrieTable(charge.tables[1], 5)]);
    assert.deepEqual(englobantDuTour(etat), attendu);
  });

  test('englobantDuTour : null sans table', () => {
    const charge = chargeDEpreuve();
    charge.tables = [];
    assert.equal(englobantDuTour(etatPlaces(charge, { tour: 1 })), null);
  });

  test('toursOfferts : 1 à R, croissants', () => {
    assert.deepEqual(toursOfferts(1), [1]);
    assert.deepEqual(toursOfferts(4), [1, 2, 3, 4]);
  });

  test('tourAffiche : le tour demandé, ramené au dernier quand le nombre de tours a baissé', () => {
    assert.equal(tourAffiche(2, 3), 2);
    assert.equal(tourAffiche(3, 3), 3);
    assert.equal(tourAffiche(5, 3), 3);
    assert.equal(tourAffiche(1, 1), 1);
  });

  test('nomDeCharge : le nom affiché de chaque participant, par identifiant', () => {
    const nomDe = nomDeCharge(chargeDEpreuve());
    assert.equal(nomDe(1), 'Iris Ombrelle');
    assert.equal(nomDe(2), 'Grisaille');
  });

  test('appartenanceDeCharge : l’appartenance de chaque participant telle que la liste la porte, null sans appartenance ni participant', () => {
    const charge = chargeDEpreuve();
    charge.participants[0].appartenance = ' Cercle des Hérons';
    const appartenanceDe = appartenanceDeCharge(charge);
    assert.equal(appartenanceDe(1), ' Cercle des Hérons');
    assert.equal(appartenanceDe(2), null);
    assert.equal(appartenanceDe(99), null);
  });
});

describe('sourceMontree : ce que la barre de vue dit du placement montré (§ 2.1 étape 11, § 5.8)', () => {
  // Les champs d'EtatPlaces que la barre lit : source, proposition, cible, refus.
  const etat = (source, { proposition = null, cible = null, refus = null } = {}) => ({ source, proposition, cible, refus });

  test('le retenu, les réservations, un retenu illisible : un libellé chacun, aucune commande sans proposition demandée', () => {
    assert.deepEqual(sourceMontree(etat('retenu', { cible: 'retenu' }), null, true), {
      libelle: { cle: 'plan.source.retenu', details: {} },
      revenir: null,
    });
    assert.deepEqual(sourceMontree(etat('reservations', { cible: 'reservations' }), null, false), {
      libelle: { cle: 'plan.source.reservations', details: {} },
      revenir: null,
    });
    const fautif = etat('reservations', { refus: { code: 'RETENU_FAUTIF', details: {} } });
    assert.deepEqual(sourceMontree(fautif, null, true).libelle, { cle: 'plan.source.retenuFautif', details: {} });
  });

  test('une proposition montrée avant la retenue : ses gestes posent des réservations ; la commande revient aux réservations', () => {
    assert.deepEqual(sourceMontree(etat('proposition', { proposition: 3, cible: 'reservations' }), 3, false), {
      libelle: { cle: 'plan.source.propositionReservations', details: { proposition: 3 } },
      revenir: 'plan.source.revenirReservations',
    });
  });

  test('une proposition montrée après la retenue : vue seule ; la commande revient au retenu', () => {
    const refus = { code: 'PROPOSITION_MONTREE', details: { proposition: 2, remede: null } };
    assert.deepEqual(sourceMontree(etat('proposition', { proposition: 2, refus }), 2, true), {
      libelle: { cle: 'plan.source.propositionVueSeule', details: { proposition: 2 } },
      revenir: 'plan.source.revenirRetenu',
    });
  });

  test('une proposition demandée qu’un tour ne porte pas : le plan dit sa source réelle, et la commande reste offerte', () => {
    assert.deepEqual(sourceMontree(etat('retenu', { cible: 'retenu' }), 2, true), {
      libelle: { cle: 'plan.source.retenu', details: {} },
      revenir: 'plan.source.revenirRetenu',
    });
  });

  test('une source hors du contrat lève', () => {
    assert.throws(() => sourceMontree(etat('autre'), null, false), TypeError);
  });
});

describe('placerBulle : une bulle reste dans la zone du plan (§ 7.1, § 7.3)', () => {
  // Une zone de 600 × 400 px dont le coin est à (20, 10) : bords droit 620
  // et bas 410.
  const ZONE = { gauche: 20, haut: 10, largeur: 600, hauteur: 400 };

  test('une bulle qui tient à droite et dessous reste à son ancre', () => {
    assert.deepEqual(placerBulle({ x: 100, y: 50, xRepli: 60 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 100, y: 50 });
    // Au ras des bords droit et bas, elle tient encore.
    assert.deepEqual(placerBulle({ x: 420, y: 310 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 420, y: 310 });
  });

  test('qui déborde à droite, elle passe à gauche de xRepli, son bord droit sur lui', () => {
    assert.deepEqual(placerBulle({ x: 500, y: 50, xRepli: 440 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 240, y: 50 });
    // Sans xRepli, le repli se fait autour de x.
    assert.deepEqual(placerBulle({ x: 500, y: 50 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 300, y: 50 });
  });

  test('qui déborde dessous, elle passe au-dessus de son ancre, son bord bas sur elle', () => {
    assert.deepEqual(placerBulle({ x: 100, y: 380 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 100, y: 280 });
  });

  test('sans place d’un côté ni de l’autre, elle se cale sur le bord opposé, jamais avant le début de la zone', () => {
    // 200 px à droite de 500 débordent ; à gauche de 150, il manque 30 px.
    assert.deepEqual(placerBulle({ x: 500, y: 50, xRepli: 150 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 420, y: 50 });
    // Plus large que la zone : calée au bord gauche.
    assert.deepEqual(placerBulle({ x: 500, y: 50, xRepli: 150 }, { largeur: 700, hauteur: 100 }, ZONE), { x: 20, y: 50 });
    // Plus haute que la zone, sous une ancre basse : calée au bord haut.
    assert.deepEqual(placerBulle({ x: 100, y: 300 }, { largeur: 200, hauteur: 500 }, ZONE), { x: 100, y: 10 });
  });

  test('une ancre avant le bord gauche ou le bord haut ramène la bulle sur ce bord, même quand elle tient', () => {
    // L'ancre d'une table coupée par le haut du cadre : au-dessus de la zone.
    assert.deepEqual(placerBulle({ x: 100, y: -50 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 100, y: 10 });
    // Au-dessus et à gauche : calée dans le coin haut gauche.
    assert.deepEqual(placerBulle({ x: -40, y: -50, xRepli: -90 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 20, y: 10 });
    // Une taille encore inconnue ne la laisse pas non plus hors de la zone.
    assert.deepEqual(placerBulle({ x: -40, y: -50 }, { largeur: 0, hauteur: 0 }, ZONE), { x: 20, y: 10 });
  });

  test('une ancre après le bord droit ou le bord bas ramène la bulle dans la zone, son bord sur ce bord', () => {
    // À droite de la zone, son repli encore après le bord : le bord droit
    // de la bulle sur celui de la zone, 620 − 50.
    assert.deepEqual(placerBulle({ x: 700, y: 50, xRepli: 690 }, { largeur: 50, hauteur: 100 }, ZONE), { x: 570, y: 50 });
    // Sous la zone, 100 px au-dessus de l'ancre ne suffisent pas : le bord
    // bas de la bulle sur celui de la zone, 410 − 100.
    assert.deepEqual(placerBulle({ x: 100, y: 450 }, { largeur: 200, hauteur: 100 }, ZONE), { x: 100, y: 310 });
  });

  test('une taille encore inconnue — zéro, avant la première mesure — laisse la bulle à son ancre', () => {
    assert.deepEqual(placerBulle({ x: 615, y: 405, xRepli: 580 }, { largeur: 0, hauteur: 0 }, ZONE), { x: 615, y: 405 });
  });

  test('les arguments ne sont pas modifiés ; un nombre non fini lève', () => {
    const ancre = { x: 500, y: 380, xRepli: 440 };
    const taille = { largeur: 200, hauteur: 100 };
    const zone = { ...ZONE };
    placerBulle(ancre, taille, zone);
    assert.deepEqual([ancre, taille, zone], [{ x: 500, y: 380, xRepli: 440 }, { largeur: 200, hauteur: 100 }, ZONE]);
    assert.throws(() => placerBulle({ x: Number.NaN, y: 0 }, taille, zone), TypeError);
    assert.throws(() => placerBulle({ x: 0, y: 0 }, { largeur: Infinity, hauteur: 0 }, zone), TypeError);
    assert.throws(() => placerBulle({ x: 0, y: 0 }, taille, { ...ZONE, hauteur: undefined }), TypeError);
  });
});
