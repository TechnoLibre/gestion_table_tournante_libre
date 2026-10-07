// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la machine d'un geste du plan (§ 7.1, § 7.2, § 7.3, § 8.4),
// sans DOM : un appui sous le seuil sélectionne, au-delà il glisse ; le
// modèle ne reçoit qu'une commande, au relâcher ; chaque annulation
// restaure ; le compte d'inactivité se suspend à l'appui et repart au
// relâcher comme à l'annulation, pour chaque genre de source ; la poignée
// s'arrête au plus proche nombre que le contrôle accepte. Les valeurs
// attendues viennent des fonctions de src/geometrie, sollicitées une seconde
// fois.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { constante } from '../../geometrie/constantes.js';
import { placesSousPoignee } from '../../geometrie/tables.js';
import { deplacer, deplacerVue, dessinDepuisEcran, transformDe } from '../../geometrie/vue.js';
import { TABLE as LIBELLES } from '../libelles/plan.js';
import { REPOS, cleFantome, geste, libellePlace, memoriser } from './gestes.js';

const SEUIL = constante('SEUIL_GLISSER_PX');
const VUE = { k: 2, tx: 100, ty: 50 };
const CADRE = { gauche: 10, haut: 20, largeur: 800, hauteur: 600 };
const DEPART = { x: 400, y: 300 };
const POINTEUR = 7;

const SOURCES = {
  table: { genre: 'table', table: 3, siege: null, participant: null, position: { x: 120, y: -40 } },
  personne: { genre: 'personne', table: 3, siege: 2, participant: 11, position: null },
  poignee: { genre: 'poignee', table: 3, siege: null, participant: null, places: 8 },
  sol: { genre: 'sol', table: null, siege: null, participant: null },
};

// Un contexte dont le contrôle accepte tout, et dont le dépôt rend la
// commande donnée.
function contexte({ controlerPlaces = () => ({ refus: null, avertissements: [] }), depot = null } = {}) {
  const deposes = [];
  return {
    deposes,
    controlerPlaces,
    deposer(source, point) {
      deposes.push({ source, point });
      return depot ?? { resultat: { commande: 'deplacerDansRetenu', arguments: { tour: 1 } }, place: { table: 4, siege: 1 } };
    },
  };
}

// Joue une suite d'événements depuis le repos ; rend l'état final et les
// effets de chaque événement.
function jouer(evenements, ctx = contexte()) {
  let etat = REPOS;
  const effets = [];
  for (const evenement of evenements) {
    const rendu = geste(etat, evenement, ctx);
    etat = rendu.etat;
    effets.push(rendu.effets);
  }
  return { etat, effets, tous: effets.flat() };
}

const presser = (source, point = DEPART) => ({ type: 'presser', source, pointeur: POINTEUR, point, vue: VUE, cadre: CADRE });
const bouger = (dx, dy) => ({ type: 'bouger', pointeur: POINTEUR, point: { x: DEPART.x + dx, y: DEPART.y + dy } });
const relacher = (dx, dy) => ({ type: 'relacher', pointeur: POINTEUR, point: { x: DEPART.x + dx, y: DEPART.y + dy } });
const annuler = (cause) => ({ type: 'annuler', cause });
const types = (effets) => effets.map(({ type }) => type);
const deType = (effets, type) => effets.filter((effet) => effet.type === type);

describe('geste : un clic n’est pas un glisser (§ 8.4)', () => {
  test('le seuil n’est pas nul, et vaut entre 3 et 5 px', () => {
    assert.ok(SEUIL > 3 && SEUIL < 5, `SEUIL_GLISSER_PX = ${SEUIL}`);
  });

  for (const genre of Object.keys(SOURCES)) {
    test(`${genre} : appui, 3 px, relâcher → selectionner, aucun executer ; capturer et debuterGeste à l’appui, finirGeste au relâcher`, () => {
      const { etat, effets } = jouer([presser(SOURCES[genre]), bouger(3, 0), relacher(3, 0)]);
      assert.deepEqual(types(effets[0]), ['capturer', 'debuterGeste']);
      assert.equal(effets[0][0].pointeur, POINTEUR);
      assert.deepEqual(effets[1], []);
      assert.deepEqual(types(effets[2]), ['selectionner', 'finirGeste']);
      assert.deepEqual(etat, REPOS);
    });
  }

  test('la place sélectionnée : la chaise, la table, la table de la poignée, rien pour le sol', () => {
    const place = (genre) => deType(jouer([presser(SOURCES[genre]), relacher(0, 0)]).tous, 'selectionner')[0].place;
    assert.deepEqual(place('personne'), { table: 3, siege: 2 });
    assert.deepEqual(place('table'), { table: 3 });
    assert.deepEqual(place('poignee'), { table: 3 });
    assert.equal(place('sol'), null);
  });
});

describe('geste : le glissement d’une table (§ 7.1, § 7.2, § 7.3)', () => {
  test('5 px → glissement : ecrireTransform à chaque image, en écart, un seul executer au relâcher', () => {
    const { effets, tous } = jouer([presser(SOURCES.table), bouger(5, 0), bouger(20, -6), bouger(40, -20), relacher(40, -20)]);
    for (const rang of [1, 2, 3]) {
      assert.deepEqual(types(effets[rang]), ['ecrireTransform'], `image ${rang}`);
      assert.deepEqual(effets[rang][0].cible, { genre: 'table', table: 3 });
    }
    assert.equal(effets[1][0].transform, 'translate(2.5,0)');
    assert.equal(effets[3][0].transform, 'translate(20,-10)');
    const executes = deType(tous, 'executer');
    assert.equal(executes.length, 1);
    const position = deplacer(SOURCES.table.position, DEPART, { x: DEPART.x + 40, y: DEPART.y - 20 }, VUE.k);
    assert.deepEqual(executes[0].arguments, { id: 3, position });
    assert.deepEqual(position, { x: 140, y: -50 });
    assert.equal(executes[0].commande, 'deplacerTable');
    assert.deepEqual(executes[0].place, { table: 3 });
    assert.deepEqual(executes[0].apres, { genre: 'table', table: 3 });
    assert.deepEqual(types(effets[4]), ['ecrireTransform', 'executer', 'finirGeste']);
  });

  test('la position s’arrondit au centimètre', () => {
    const { tous } = jouer([presser(SOURCES.table), bouger(13, 7), relacher(13, 7)]);
    assert.deepEqual(deType(tous, 'executer')[0].arguments.position, { x: 127, y: -36 });
  });

  test('un relâcher loin, sans mouvement livré entre-temps, glisse quand même', () => {
    const { tous } = jouer([presser(SOURCES.table), relacher(40, -20)]);
    assert.equal(deType(tous, 'executer').length, 1);
    assert.equal(deType(tous, 'selectionner').length, 0);
  });

  for (const cause of ['pointercancel', 'echap', 'lecture']) {
    test(`${cause} pendant le glissement → restaurer la table, finirGeste, aucun executer, puis le repos`, () => {
      const { etat, effets, tous } = jouer([presser(SOURCES.table), bouger(30, 0), annuler(cause), relacher(30, 0)]);
      assert.deepEqual(effets[2], [{ type: 'restaurer', cible: { genre: 'table', table: 3 } }, { type: 'finirGeste' }]);
      assert.deepEqual(effets[3], [], 'le relâcher qui suit une annulation ne fait rien');
      assert.equal(deType(tous, 'executer').length, 0);
      assert.deepEqual(etat, REPOS);
    });
  }
});

describe('geste : chaque genre de source, le compte d’inactivité et les annulations (§ 8.4)', () => {
  const CIBLES = { table: { genre: 'table', table: 3 }, personne: 'fantome', poignee: { genre: 'poignee', table: 3 }, sol: 'vue' };
  for (const genre of Object.keys(SOURCES)) {
    for (const cause of ['pointercancel', 'echap', 'lecture']) {
      test(`${genre}, ${cause} : debuterGeste à l’appui, restaurer et finirGeste à l’annulation, aucun executer`, () => {
        const { tous } = jouer([presser(SOURCES[genre]), bouger(25, 25), annuler(cause)]);
        assert.equal(deType(tous, 'debuterGeste').length, 1);
        assert.equal(deType(tous, 'finirGeste').length, 1);
        assert.deepEqual(deType(tous, 'restaurer'), [{ type: 'restaurer', cible: CIBLES[genre] }]);
        assert.equal(deType(tous, 'executer').length, 0);
      });
    }
    test(`${genre} : une annulation sous le seuil restaure aussi, et finit le geste`, () => {
      const { tous } = jouer([presser(SOURCES[genre]), annuler('echap')]);
      assert.deepEqual(types(tous), ['capturer', 'debuterGeste', 'restaurer', 'finirGeste']);
    });
    test(`${genre} : finirGeste au relâcher d’un glissement, une fois`, () => {
      const { tous } = jouer([presser(SOURCES[genre]), bouger(25, 25), relacher(25, 25)]);
      assert.equal(deType(tous, 'debuterGeste').length, 1);
      assert.equal(deType(tous, 'finirGeste').length, 1);
      assert.equal(tous.at(-1).type, 'finirGeste');
    });
  }

  test('au repos, bouger, relâcher et annuler ne font rien', () => {
    for (const evenement of [bouger(10, 10), relacher(10, 10), annuler('echap')]) {
      assert.deepEqual(geste(REPOS, evenement, contexte()), { etat: REPOS, effets: [] });
    }
  });

  test('un second appui pendant un geste est ignoré ; les mouvements d’un autre pointeur aussi', () => {
    const premier = jouer([presser(SOURCES.table), bouger(30, 0)]);
    const second = geste(premier.etat, { ...presser(SOURCES.sol), pointeur: 9 }, contexte());
    assert.deepEqual(second, { etat: premier.etat, effets: [] });
    const autre = geste(premier.etat, { ...bouger(60, 0), pointeur: 9 }, contexte());
    assert.deepEqual(autre, { etat: premier.etat, effets: [] });
    const relache = geste(premier.etat, { ...relacher(60, 0), pointeur: 9 }, contexte());
    assert.deepEqual(relache, { etat: premier.etat, effets: [] });
  });
});

describe('geste : le déplacement de vue, geste du sol (§ 7.1, § 8.5)', () => {
  test('au-delà du seuil, ecrireTransform {cible: vue} à chaque image, poserVue au relâcher, jamais executer', () => {
    const { effets, tous } = jouer([presser(SOURCES.sol), bouger(10, -5), bouger(60, -40), relacher(60, -40)]);
    const attendue = deplacerVue(VUE, DEPART, { x: DEPART.x + 60, y: DEPART.y - 40 });
    assert.deepEqual(effets[1], [{ type: 'ecrireTransform', cible: 'vue', transform: transformDe(deplacerVue(VUE, DEPART, { x: DEPART.x + 10, y: DEPART.y - 5 })) }]);
    assert.deepEqual(effets[2], [{ type: 'ecrireTransform', cible: 'vue', transform: transformDe(attendue) }]);
    assert.deepEqual(deType(tous, 'poserVue'), [{ type: 'poserVue', vue: attendue }]);
    assert.deepEqual(attendue, { k: 2, tx: 160, ty: 10 });
    assert.equal(deType(tous, 'executer').length, 0);
  });

  test('en deçà du seuil, relâcher sur le sol désélectionne', () => {
    const { tous } = jouer([presser(SOURCES.sol), bouger(2, 2), relacher(2, 2)]);
    assert.deepEqual(deType(tous, 'selectionner'), [{ type: 'selectionner', place: null }]);
    assert.equal(deType(tous, 'poserVue').length, 0);
  });
});

describe('geste : glisser une personne (§ 7.1, § 7.3, § 5.8)', () => {
  test('le fantôme se montre au franchissement du seuil, suit le pointeur en px du <svg>, et le dépôt se demande au point de dessin', () => {
    const ctx = contexte();
    const { effets } = jouer([presser(SOURCES.personne), bouger(10, 0), bouger(50, 30), relacher(50, 30)], ctx);
    assert.deepEqual(effets[1][0], { type: 'montrerFantome', participant: 11, depuis: { table: 3, siege: 2 } });
    assert.deepEqual(effets[1][1], { type: 'ecrireTransform', cible: 'fantome', transform: `translate(${DEPART.x + 10 - CADRE.gauche},${DEPART.y - CADRE.haut})` });
    assert.equal(ctx.deposes.length, 1);
    assert.deepEqual(ctx.deposes[0].point, dessinDepuisEcran(VUE, CADRE, DEPART.x + 50, DEPART.y + 30));
    assert.equal(ctx.deposes[0].source, SOURCES.personne);
    assert.deepEqual(types(effets[3]), ['ecrireTransform', 'restaurer', 'executer', 'finirGeste']);
    assert.deepEqual(effets[3][1], { type: 'restaurer', cible: 'fantome' });
    assert.deepEqual(effets[3][2], {
      type: 'executer',
      commande: 'deplacerDansRetenu',
      arguments: { tour: 1 },
      place: { table: 4, siege: 1 },
      apres: null,
    });
  });

  test('un dépôt refusé : la personne revient, le refus se montre sur la place, rien n’est exécuté', () => {
    const refus = { code: 'PROPOSITION_MONTREE', details: { proposition: 2, remede: { geste: 'afficherTour', tour: 1, proposition: null } } };
    const ctx = contexte({ depot: { resultat: { refus }, place: { table: 5, siege: 3 } } });
    const { effets, tous } = jouer([presser(SOURCES.personne), bouger(50, 30), relacher(50, 30)], ctx);
    assert.deepEqual(types(effets[2]), ['ecrireTransform', 'restaurer', 'montrerRefus', 'finirGeste']);
    assert.deepEqual(deType(tous, 'montrerRefus'), [{ type: 'montrerRefus', place: { table: 5, siege: 3 }, refus }]);
    assert.equal(deType(tous, 'executer').length, 0);
  });

  test('un dépôt manqué (null) : la personne revient, rien d’autre', () => {
    const ctx = contexte({ depot: { resultat: null, place: { table: 3, siege: 2 } } });
    const { effets } = jouer([presser(SOURCES.personne), bouger(50, 30), relacher(50, 30)], ctx);
    assert.deepEqual(types(effets[2]), ['ecrireTransform', 'restaurer', 'finirGeste']);
  });

  test('une chaise vide se sélectionne, et ne glisse rien', () => {
    const vide = { ...SOURCES.personne, participant: null };
    const ctx = contexte();
    const { tous } = jouer([presser(vide), bouger(50, 30), relacher(50, 30)], ctx);
    assert.deepEqual(types(tous), ['capturer', 'debuterGeste', 'finirGeste']);
    assert.equal(ctx.deposes.length, 0);
  });
});

describe('geste : tirer la poignée (§ 7.1, § 6.2)', () => {
  // Un écart radial de r cm le long de la diagonale de la poignée, au zoom
  // de la vue : (r / √2) × k px sur chaque axe.
  const radial = (cm) => (cm / Math.SQRT2) * VUE.k;

  test('le nombre suit placesSousPoignee, en écart projeté sur la diagonale ; le relâcher exécute changerPlacesTable, origine poignee', () => {
    const vers = radial(30);
    const { effets, tous } = jouer([presser(SOURCES.poignee), bouger(vers, vers), relacher(vers, vers)]);
    const attendu = placesSousPoignee(8, 30);
    assert.equal(attendu, 11);
    assert.deepEqual(effets[1][0], { type: 'montrerPlaces', table: 3, places: attendu, avertissements: [] });
    assert.deepEqual(deType(tous, 'executer'), [
      {
        type: 'executer',
        commande: 'changerPlacesTable',
        arguments: { id: 3, sieges: attendu, origine: 'poignee' },
        place: { table: 3 },
        apres: { genre: 'poignee', table: 3 },
      },
    ]);
  });

  test('un écart perpendiculaire à la diagonale ne change rien', () => {
    const { tous } = jouer([presser(SOURCES.poignee), bouger(40, -40), relacher(40, -40)]);
    assert.equal(deType(tous, 'executer').length, 0);
    assert.deepEqual(deType(tous, 'restaurer'), [{ type: 'restaurer', cible: { genre: 'poignee', table: 3 } }]);
  });

  test('vers un nombre refusé : montrerPlaces au plus proche accepté entre lui et le nombre initial, et montrerRefus du nombre qui l’arrête', () => {
    const appels = [];
    const sousOccupes = (n) => ({ code: 'SOUS_OCCUPES', details: { table: 3, n, tour: 3, remede: null } });
    const controlerPlaces = (table, places) => {
      appels.push([table, places]);
      return places < 7 ? { refus: sousOccupes(places), avertissements: [] } : { refus: null, avertissements: [] };
    };
    const vers = radial(-29);
    const { tous } = jouer([presser(SOURCES.poignee), bouger(vers, vers), relacher(vers, vers)], contexte({ controlerPlaces }));
    assert.equal(placesSousPoignee(8, -29), 5);
    assert.deepEqual(deType(tous, 'montrerPlaces')[0], { type: 'montrerPlaces', table: 3, places: 7, avertissements: [] });
    assert.deepEqual(deType(tous, 'montrerRefus')[0], { type: 'montrerRefus', place: { table: 3 }, refus: sousOccupes(6) });
    assert.deepEqual(deType(tous, 'executer')[0].arguments, { id: 3, sieges: 7, origine: 'poignee' });
    assert.ok(appels.some(([, places]) => places === 5));
  });

  test('arrêté au nombre initial : rien n’est exécuté au relâcher', () => {
    const controlerPlaces = (table, places) => (places < 8 ? { refus: { code: 'SIEGES_RETIRES', details: { table, sieges: [] } }, avertissements: [] } : { refus: null, avertissements: [] });
    const vers = radial(-40);
    const { tous } = jouer([presser(SOURCES.poignee), bouger(vers, vers), relacher(vers, vers)], contexte({ controlerPlaces }));
    assert.deepEqual(deType(tous, 'montrerPlaces')[0].places, 8);
    assert.equal(deType(tous, 'montrerRefus')[0].refus.code, 'SIEGES_RETIRES');
    assert.equal(deType(tous, 'executer').length, 0);
  });

  test('un avertissement accompagne le nombre montré sans l’arrêter ; le refus s’efface quand le nombre n’est plus arrêté', () => {
    const lisible = { code: 'AU_DELA_LISIBLE', details: { seuil: 16 } };
    const controlerPlaces = (table, places) => {
      if (places < 8) return { refus: { code: 'MOINS_DE_DEUX', details: { remede: null } }, avertissements: [] };
      return { refus: null, avertissements: places > 16 ? [lisible] : [] };
    };
    const ctx = contexte({ controlerPlaces });
    const { effets } = jouer([presser(SOURCES.poignee), bouger(radial(-20), radial(-20)), bouger(radial(100), radial(100))], ctx);
    assert.deepEqual(deType(effets[1], 'montrerRefus').length, 1);
    assert.deepEqual(effets[2], [
      { type: 'montrerPlaces', table: 3, places: placesSousPoignee(8, 100), avertissements: [lisible] },
      { type: 'montrerRefus', place: { table: 3 }, refus: null },
    ]);
  });

  test('un mouvement qui ne change ni le nombre ni le refus n’émet rien', () => {
    const { effets } = jouer([presser(SOURCES.poignee), bouger(radial(30), radial(30)), bouger(radial(31), radial(31))]);
    assert.deepEqual(effets[2], []);
  });
});

describe('memoriser : un contrôle par nombre et par geste', () => {
  test('le même nombre ne se contrôle qu’une fois ; chaque nombre rend son propre rendu', () => {
    const appels = [];
    const controle = memoriser((table, places) => {
      appels.push(places);
      return { refus: null, avertissements: [], places, table };
    });
    assert.equal(controle(3, 9).places, 9);
    assert.equal(controle(3, 9).places, 9);
    assert.equal(controle(3, 10).places, 10);
    assert.equal(controle(4, 9).table, 4);
    assert.deepEqual(appels, [9, 10, 9]);
  });
});

describe('les libellés d’un geste : le fantôme et la place d’une pose', () => {
  test('cleFantome : la clé du libellé du fantôme, selon la cible de l’état des places', () => {
    assert.equal(cleFantome('reservations'), 'plan.fantome.reservations');
    assert.equal(cleFantome('retenu'), 'plan.fantome.retenu');
    assert.equal(cleFantome(null), 'plan.fantome.vueSeule');
    for (const cible of ['reservations', 'retenu', null]) assert.equal(LIBELLES.has(cleFantome(cible)), true);
  });

  test('cleFantome : sous les réservations, une personne réservée déplace sa réservation, et le libellé en dit la portée', () => {
    // Le dépôt d'une personne réservée exécute deplacerReservation, qui garde
    // la portée : « tous les tours » se dit pendant le geste (§ 5.8, § 7.1).
    assert.equal(cleFantome('reservations', null), 'plan.fantome.reservations');
    assert.equal(cleFantome('reservations', 'tour'), 'plan.fantome.reservationTour');
    assert.equal(cleFantome('reservations', 'tous'), 'plan.fantome.reservationTous');
    for (const portee of [null, 'tour', 'tous']) {
      assert.equal(cleFantome('retenu', portee), 'plan.fantome.retenu');
      assert.equal(cleFantome(null, portee), 'plan.fantome.vueSeule');
      assert.equal(LIBELLES.has(cleFantome('reservations', portee)), true);
    }
    assert.match(LIBELLES.get(cleFantome('reservations', 'tous')), /tous les tours/);
    for (const portee of ['Tous', 'tours', '', 0]) {
      assert.throws(() => cleFantome('reservations', portee), { name: 'TypeError', message: /^portée du fantôme hors du contrat/ });
    }
  });

  test('cleFantome : une cible hors du contrat lève, au lieu de se dire « vue seule »', () => {
    for (const cible of ['reservation', 'Retenu', undefined, '', 0]) {
      assert.throws(() => cleFantome(cible), { name: 'TypeError', message: /^cible du fantôme hors du contrat/ });
    }
  });

  test('libellePlace : la table seule sans siège, la table et le siège sinon', () => {
    assert.deepEqual(libellePlace({ numero: 7, siege: null }), { cle: 'plan.refus.table', details: { numero: 7 } });
    assert.deepEqual(libellePlace({ numero: 7, siege: 3 }), { cle: 'plan.refus.siege', details: { numero: 7, siege: 3 } });
    for (const siege of [null, 3]) assert.equal(LIBELLES.has(libellePlace({ numero: 7, siege }).cle), true);
  });

  test('libellePlace : un siège qui n’est ni null ni un entier positif lève', () => {
    for (const siege of [undefined, 0, -1, 2.5, '3']) {
      assert.throws(() => libellePlace({ numero: 7, siege }), { name: 'TypeError', message: /^siège d’une place hors du contrat/ });
    }
  });
});
