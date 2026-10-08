// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la place d'une infobulle (§ 12.7, § 14.5) : sous le terme
// quand elle y tient, au-dessus sinon ; jamais sur le terme qu'elle
// explique quand un côté la reçoit ; toujours dans le cadre, à la marge
// près.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { MARGE_INFOBULLE_PX, ECART_INFOBULLE_PX, placerInfobulle } from './infobulle.js';

const CADRE = { largeur: 1366, hauteur: 700 };
const TAILLE = { largeur: 300, hauteur: 90 };

// Le rectangle d'un terme de largeur et de hauteur données, coin haut gauche
// en (gauche, haut).
const terme = (gauche, haut, largeur = 120, hauteur = 20) => ({ gauche, haut, droite: gauche + largeur, bas: haut + hauteur });

// La boîte de l'infobulle placée.
const boite = ({ gauche, haut }, { largeur, hauteur }) => ({ gauche, haut, droite: gauche + largeur, bas: haut + hauteur });

const recouvre = (a, b) => a.gauche < b.droite && b.gauche < a.droite && a.haut < b.bas && b.haut < a.bas;

const dansLeCadre = (b, cadre) =>
  b.gauche >= MARGE_INFOBULLE_PX &&
  b.haut >= MARGE_INFOBULLE_PX &&
  b.droite <= cadre.largeur - MARGE_INFOBULLE_PX &&
  b.bas <= cadre.hauteur - MARGE_INFOBULLE_PX;

describe('placerInfobulle : sous le terme, au-dessus, dans le cadre', () => {
  test('la place sous le terme suffit : l’infobulle s’y pose, alignée sur son bord gauche, à l’écart du terme', () => {
    const ancre = terme(200, 100);
    const place = placerInfobulle(ancre, TAILLE, CADRE);
    assert.deepEqual(place, { gauche: 200, haut: 120 + ECART_INFOBULLE_PX, cote: 'dessous' });
    assert.ok(!recouvre(boite(place, TAILLE), ancre));
  });

  test('trop bas pour elle : l’infobulle passe au-dessus du terme', () => {
    const ancre = terme(200, 640);
    const place = placerInfobulle(ancre, TAILLE, CADRE);
    assert.deepEqual(place, { gauche: 200, haut: 640 - ECART_INFOBULLE_PX - TAILLE.hauteur, cote: 'dessus' });
    assert.ok(!recouvre(boite(place, TAILLE), ancre));
  });

  test('près du bord droit, l’infobulle recule dans le cadre ; un terme coupé par le bord gauche la laisse à la marge', () => {
    const droite = placerInfobulle(terme(1300, 100, 60), TAILLE, CADRE);
    assert.equal(droite.gauche, CADRE.largeur - MARGE_INFOBULLE_PX - TAILLE.largeur);
    const gauche = placerInfobulle(terme(-50, 100), TAILLE, CADRE);
    assert.equal(gauche.gauche, MARGE_INFOBULLE_PX);
  });

  test('plus large que le cadre : collée à la marge gauche', () => {
    const place = placerInfobulle(terme(400, 100), { largeur: 2000, hauteur: 90 }, CADRE);
    assert.equal(place.gauche, MARGE_INFOBULLE_PX);
  });

  test('aucun côté ne la reçoit : le côté le plus grand, et la boîte reste dans le cadre', () => {
    const petit = { largeur: 1366, hauteur: 200 };
    const haute = { largeur: 300, hauteur: 150 };
    const bas = placerInfobulle(terme(200, 40), haute, petit);
    assert.equal(bas.cote, 'dessous');
    assert.ok(dansLeCadre(boite(bas, haute), petit), JSON.stringify(bas));
    const haut = placerInfobulle(terme(200, 140), haute, petit);
    assert.equal(haut.cote, 'dessus');
    assert.ok(dansLeCadre(boite(haut, haute), petit), JSON.stringify(haut));
  });

  test('sur une grille de termes qui couvre le cadre : dès qu’un côté la reçoit, l’infobulle reste dans le cadre et ne couvre jamais le terme', () => {
    let essais = 0;
    for (let gauche = -100; gauche <= CADRE.largeur; gauche += 37) {
      for (let haut = 0; haut <= CADRE.hauteur - 20; haut += 23) {
        for (const largeur of [10, 120, 400]) {
          const ancre = terme(gauche, haut, largeur);
          const place = placerInfobulle(ancre, TAILLE, CADRE);
          const b = boite(place, TAILLE);
          assert.ok(dansLeCadre(b, CADRE), `${gauche}, ${haut}, ${largeur} : ${JSON.stringify(place)}`);
          assert.ok(!recouvre(b, ancre), `${gauche}, ${haut}, ${largeur} : ${JSON.stringify(place)}`);
          essais += 1;
        }
      }
    }
    assert.ok(essais > 1000, String(essais));
  });
});
