// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du registre de gel : figer gèle en profondeur, les enfants avant
// le parent, et n'inscrit au registre que ce dont tout le contenu est gelé ;
// un gel de surface (Object.freeze seul) n'y entre pas et ne dispense pas du
// parcours ; un sous-arbre déjà inscrit ne se reparcourt pas. gelerPropositions
// fige les propositions d'une charge sans geler ni la liste ni la charge, et
// copieDeTravail rend l'égale d'un structuredClone qui partage les
// propositions figées et ne partage rien d'autre. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { copieDeTravail, estFigee, figer, gelerPropositions } from './gel.js';

// Tous les objets que valeur atteint, elle comprise, chacun une fois.
function objetsDe(valeur, vus = new Set()) {
  if (valeur === null || typeof valeur !== 'object' || vus.has(valeur)) return vus;
  vus.add(valeur);
  for (const enfant of Object.values(valeur)) objetsDe(enfant, vus);
  return vus;
}

// Une proposition d'épreuve, à trois niveaux d'imbrication.
const proposition = (id) => ({
  id,
  nom: `Proposition ${id}`,
  etat: 'brouillon',
  tours: [
    {
      tables: [
        { table: 1, sieges: [{ participant: 1, siege: 0 }] },
        { table: 2, sieges: [] },
      ],
      reserve: [3],
    },
  ],
  mesures: { rencontres: { repetees: 0 }, notes: ['Ambrelle'] },
});

// Une charge d'épreuve aux clés dans un ordre qui n'est pas l'alphabétique,
// pour que l'ordre de la copie se lise : propositions n'y est ni la première
// ni la dernière clé.
const charge = () => ({
  evenement: { nom: 'Soirée Tamaris', tours: 1 },
  participants: [
    { id: 1, nom: 'Corvin', prenom: 'Ambrelle', exclu: false },
    { id: 2, nom: 'Quintil', prenom: 'Tamaris', exclu: false },
  ],
  propositions: [proposition(1), proposition(2)],
  retenu: null,
  compteurs: { participant: 2, proposition: 2 },
});

// Les écritures qu'un objet gelé refuse, chacune en TypeError (mode strict).
function assertImmuable(objet, chemin) {
  assert.throws(
    () => {
      objet.ajout = 1;
    },
    TypeError,
    `${chemin} : ajout`,
  );
  if (Array.isArray(objet)) {
    assert.throws(() => objet.push(0), TypeError, `${chemin} : push`);
    if (objet.length > 0) {
      assert.throws(
        () => {
          objet[0] = 'autre';
        },
        TypeError,
        `${chemin}[0] : écriture`,
      );
    }
    return;
  }
  for (const cle of Object.keys(objet)) {
    assert.throws(
      () => {
        objet[cle] = 'autre';
      },
      TypeError,
      `${chemin}.${cle} : écriture`,
    );
    assert.throws(
      () => {
        delete objet[cle];
      },
      TypeError,
      `${chemin}.${cle} : retrait`,
    );
  }
}

// Visite valeur à toute profondeur et rend chaque objet avec son chemin.
function cheminsDe(valeur, chemin = 'racine', rendus = []) {
  if (valeur === null || typeof valeur !== 'object') return rendus;
  rendus.push([chemin, valeur]);
  for (const [cle, enfant] of Object.entries(valeur)) cheminsDe(enfant, `${chemin}.${cle}`, rendus);
  return rendus;
}

// Un Proxy sur cible qui compte les lectures et les relevés de clés.
function compteur(cible) {
  const releve = { lectures: 0 };
  const proxy = new Proxy(cible, {
    get(c, cle, recepteur) {
      releve.lectures += 1;
      return Reflect.get(c, cle, recepteur);
    },
    ownKeys(c) {
      releve.lectures += 1;
      return Reflect.ownKeys(c);
    },
  });
  return { proxy, releve };
}

describe('gel : figer et estFigee', () => {
  test('un gel de surface (Object.freeze seul) ne fait pas une valeur figée, et figer gèle quand même ses enfants', () => {
    const p = proposition(7);
    Object.freeze(p);
    assert.equal(estFigee(p), false);
    assert.equal(Object.isFrozen(p.tours), false);
    assert.equal(figer(p), p);
    assert.equal(estFigee(p), true);
    for (const [chemin, objet] of cheminsDe(p)) {
      assert.ok(Object.isFrozen(objet), `${chemin} gelé`);
      assert.ok(estFigee(objet), `${chemin} inscrit`);
    }
  });

  test('un enfant gelé en surface sous un parent libre est parcouru lui aussi', () => {
    const p = proposition(8);
    Object.freeze(p.tours[0]);
    figer(p);
    assert.ok(Object.isFrozen(p.tours[0].tables[0].sieges[0]));
    assert.ok(estFigee(p.tours[0].tables));
  });

  test('après figer, chaque sous-objet est gelé et inscrit, et une écriture à toute profondeur lève TypeError', () => {
    const p = figer(proposition(3));
    const chemins = cheminsDe(p);
    assert.ok(chemins.length >= 10, 'la proposition a de quoi éprouver la profondeur');
    for (const [chemin, objet] of chemins) {
      assert.ok(Object.isFrozen(objet), `${chemin} gelé`);
      assert.ok(estFigee(objet), `${chemin} inscrit`);
      assertImmuable(objet, chemin);
    }
    assert.deepEqual(p, proposition(3), 'le contenu est intact');
  });

  test('un sous-arbre déjà inscrit ne se reparcourt pas', () => {
    const { proxy, releve } = compteur({ a: { b: [1, 2] }, c: 'Corvin' });
    figer(proxy);
    assert.ok(releve.lectures > 0, 'le premier gel parcourt le Proxy');
    assert.ok(estFigee(proxy));
    releve.lectures = 0;
    const parent = { enfant: proxy, frere: { d: 1 } };
    figer(parent);
    assert.equal(releve.lectures, 0, 'le second gel ne lit rien du sous-arbre inscrit');
    assert.ok(estFigee(parent) && estFigee(parent.frere));
    assert.equal(figer(proxy), proxy);
    assert.equal(releve.lectures, 0);
  });

  test("un sous-arbre partagé n'est gelé qu'une fois, et ses deux parents sont inscrits", () => {
    const { proxy, releve } = compteur({ x: [1] });
    const parent = { gauche: { p: proxy }, droite: { p: proxy } };
    figer(parent);
    const apresPremier = releve.lectures;
    assert.ok(apresPremier > 0);
    assert.ok(estFigee(parent.gauche) && estFigee(parent.droite) && estFigee(proxy));
    figer({ encore: parent });
    assert.equal(releve.lectures, apresPremier);
  });

  test("les enfants passent avant le parent : un parcours interrompu n'inscrit ni ne gèle le parent", () => {
    const fautif = new Proxy(
      { a: 1 },
      {
        ownKeys() {
          throw new RangeError('relevé refusé');
        },
      },
    );
    const premier = { x: [1] };
    // Les clés se parcourent rangées : a avant b.
    const parent = { b: fautif, a: premier };
    assert.throws(() => figer(parent), RangeError);
    assert.equal(estFigee(parent), false);
    assert.equal(Object.isFrozen(parent), false);
    assert.equal(estFigee(fautif), false);
    // Le frère parcouru avant la faute est complet : il est figé, et seul lui.
    assert.ok(estFigee(premier) && estFigee(premier.x));
  });

  test("une valeur qui n'est pas un objet se rend telle quelle et n'est jamais figée", () => {
    for (const valeur of [null, undefined, 0, 1.5, 'Tamaris', true, 10n]) {
      assert.equal(figer(valeur), valeur);
      assert.equal(estFigee(valeur), false);
    }
    assert.equal(estFigee({}), false);
    assert.equal(estFigee([]), false);
  });
});

describe('gel : gelerPropositions', () => {
  test('fige chaque proposition objet, en place, sans geler ni la liste ni la charge', () => {
    const c = charge();
    const [p1, p2] = c.propositions;
    assert.equal(gelerPropositions(c), c);
    assert.equal(c.propositions[0], p1);
    assert.equal(c.propositions[1], p2);
    for (const p of [p1, p2]) {
      assert.ok(estFigee(p));
      for (const [chemin, objet] of cheminsDe(p)) assert.ok(estFigee(objet), chemin);
    }
    assert.equal(Object.isFrozen(c), false);
    assert.equal(Object.isFrozen(c.propositions), false);
    assert.equal(estFigee(c.propositions), false);
    assert.equal(Object.isFrozen(c.participants[0]), false);
    c.propositions.push(proposition(3));
    c.retenu = { proposition: 1 };
    assert.equal(estFigee(c.propositions[2]), false);
  });

  test("une proposition qui n'est pas un objet reste telle quelle, et une liste absente ne lève pas", () => {
    const c = { propositions: [null, 4, 'Quintil', proposition(5)] };
    gelerPropositions(c);
    assert.deepEqual(c.propositions.slice(0, 3), [null, 4, 'Quintil']);
    assert.ok(estFigee(c.propositions[3]));
    for (const mal of [{}, { propositions: null }, { propositions: { 0: proposition(6) } }]) {
      assert.equal(gelerPropositions(mal), mal);
    }
  });

  test('une proposition déjà figée se garde, même objet', () => {
    const p = figer(proposition(9));
    const c = { propositions: [p] };
    gelerPropositions(c);
    assert.equal(c.propositions[0], p);
  });
});

describe('gel : copieDeTravail', () => {
  test('partage les propositions figées, ne partage rien des autres, et la charge reçue est intacte', () => {
    const c = charge();
    figer(c.propositions[0]);
    const texte = JSON.stringify(c);
    const liste = c.propositions;
    const [p1, p2] = liste;
    const copie = copieDeTravail(c);
    assert.equal(copie.propositions[0], p1, 'la proposition figée est le même objet');
    assert.notEqual(copie.propositions, liste, 'la liste est neuve');
    assert.notEqual(copie, c);
    const originaux = objetsDe(c);
    const partages = [...objetsDe(copie)].filter((o) => originaux.has(o));
    assert.deepEqual(
      partages.filter((o) => !estFigee(o)),
      [],
      'seuls des objets figés se partagent',
    );
    for (const o of objetsDe(copie.propositions[1]))
      assert.equal(originaux.has(o), false, 'rien de la proposition non figée');
    assert.equal(JSON.stringify(c), texte);
    assert.equal(c.propositions, liste);
    assert.equal(c.propositions[1], p2);
    assert.equal(estFigee(copie.propositions[1]), false);
    assert.equal(Object.isFrozen(copie.propositions), false);
  });

  test("rend l'égale de structuredClone, clés dans le même ordre à toute profondeur", () => {
    const c = charge();
    c.propositions.push(proposition(3));
    figer(c.propositions[1]);
    const attendu = structuredClone(c);
    const copie = copieDeTravail(c);
    assert.equal(JSON.stringify(copie), JSON.stringify(attendu));
    assert.deepEqual(Object.keys(copie), Object.keys(attendu));
    assert.deepEqual(copie, attendu);
  });

  test('la copie se modifie hors des propositions figées sans toucher la charge reçue', () => {
    const c = charge();
    figer(c.propositions[0]);
    const texte = JSON.stringify(c);
    const copie = copieDeTravail(c);
    copie.participants[0].nom = 'Tamaris';
    copie.evenement.tours = 3;
    copie.propositions[1].tours[0].reserve.push(1);
    copie.propositions.push(proposition(4));
    copie.propositions.splice(0, 1);
    assert.equal(JSON.stringify(c), texte);
  });

  test('garde les alias internes comme structuredClone', () => {
    const commun = { note: 'Ambrelle' };
    const libre = proposition(2);
    const c = {
      evenement: { a: commun, b: commun },
      propositions: [figer(proposition(1)), libre, libre],
    };
    const copie = copieDeTravail(c);
    assert.equal(copie.evenement.a, copie.evenement.b);
    assert.notEqual(copie.evenement.a, commun);
    assert.equal(copie.propositions[1], copie.propositions[2], 'une proposition libre répétée reste un seul objet');
    assert.notEqual(copie.propositions[1], libre);
    assert.equal(copie.propositions[0], c.propositions[0]);
  });

  test('sans proposition figée, la copie ne partage rien', () => {
    const c = charge();
    const originaux = objetsDe(c);
    for (const o of objetsDe(copieDeTravail(c))) assert.equal(originaux.has(o), false);
  });

  test('toutes les propositions figées : la liste est neuve, ses éléments partagés, et un ajout ne touche pas la charge reçue', () => {
    const c = { propositions: [figer(proposition(1)), figer(proposition(2))] };
    const texte = JSON.stringify(c);
    const copie = copieDeTravail(c);
    assert.notEqual(copie.propositions, c.propositions);
    copie.propositions.forEach((p, i) => assert.equal(p, c.propositions[i]));
    copie.propositions.push(proposition(3));
    copie.propositions.splice(0, 1);
    assert.equal(JSON.stringify(c), texte, 'la charge reçue est intacte');
  });

  test("une proposition gelée en surface (Object.freeze seul) n'est pas partagée : le registre décide, non Object.isFrozen", () => {
    const p = Object.freeze(proposition(1));
    const c = { propositions: [p] };
    assert.equal(estFigee(p), false);
    const texte = JSON.stringify(c);
    const copie = copieDeTravail(c);
    assert.notEqual(copie.propositions[0], p, 'la proposition gelée en surface est recopiée');
    assert.deepEqual(copie.propositions[0], p);
    copie.propositions[0].tours[0].reserve.push(9);
    assert.equal(JSON.stringify(c), texte, 'la charge reçue est intacte');
  });

  test("une liste de propositions qui n'en est pas une se recopie comme structuredClone", () => {
    for (const mal of [{ a: 1 }, { propositions: null, b: [1] }, { propositions: { 0: proposition(1) } }]) {
      const copie = copieDeTravail(mal);
      assert.deepEqual(copie, structuredClone(mal));
      assert.equal(JSON.stringify(copie), JSON.stringify(mal));
    }
  });

  test("une proposition figée n'est jamais lue par la copie : un champ que structuredClone refuse n'y lève rien", () => {
    // structuredClone lève DataCloneError sur une fonction : la copie ne
    // réussit que si la proposition figée ne passe pas par lui.
    const p = figer({ ...proposition(1), nonRecopiable: () => 'Ambrelle' });
    const c = { evenement: { nom: 'Soirée Tamaris' }, propositions: [p, proposition(2)] };
    assert.throws(() => structuredClone(p), { name: 'DataCloneError' });
    const copie = copieDeTravail(c);
    assert.equal(copie.propositions[0], p);
    assert.deepEqual(copie.propositions[1], proposition(2));
  });
});
