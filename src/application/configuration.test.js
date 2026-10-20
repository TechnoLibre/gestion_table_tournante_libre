// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du pont de la charge vers le moteur (§ 4.5, § 5.2, D6) : qui
// anime, tour par tour, lu sur les titres pourvus ; la configuration du
// moteur, celle du stockage plus les tours animés ; les quatre
// démonstrations ; la garde qui fait de configuration.js le seul appelant de
// configurationDepuisCharge sous src/application. Les noms sont inventés.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { LIVREES } from '../demo/livrees.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { animateursDe, configurationDe } from './configuration.js';

// Une charge de trois tours, trois tables de quatre places et cinq
// personnes, sans titre ni réservation ; modifier la complète.
function chargeDe(modifier = () => {}) {
  const charge = creerCharge({ id: 'evt-pont', nom: 'Cercle des Pervenches', siegesParDefaut: 4, tours: 3 });
  const noms = [['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Brumaire', 'Anselme'], ['Givrette', 'Solène']];
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: rang % 2 === 0 ? 'Atelier des Saules' : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 100 * id, y: 0 } }));
  charge.prochainsIds = { participant: 6, table: 4, proposition: 1 };
  modifier(charge);
  return charge;
}

const titre = (table, siege, libelle = 'Animation') => ({ table, siege, libelle });
const reservation = (participant, table, siege, tour = null) =>
  ({ participant, table, siege, portee: tour === null ? 'tous' : 'tour', tour });

describe('animateursDe : qui anime, tour par tour (§ 4.5, D6)', () => {
  test('aucun titre, ou des réservations sans titre : personne n’anime', () => {
    assert.deepEqual(animateursDe(chargeDe()), []);
    const ancres = chargeDe((c) => {
      c.reservations = [reservation(1, 1, 1), reservation(2, 2, null)];
    });
    assert.deepEqual(animateursDe(ancres), []);
  });

  test('un titre pourvu au seul tour 2 fait animer au tour 2 seulement', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1)];
      c.reservations = [reservation(3, 1, 1, 2)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 3, tours: [2] }]);
  });

  test('une réservation « tous les tours » sur la place titrée fait animer à chaque tour', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(2, 3)];
      c.reservations = [reservation(4, 2, 3)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 4, tours: [1, 2, 3] }]);
  });

  test('R réservations de tour désigné sur la place titrée font animer à chaque tour, comme une seule de portée « tous »', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 2)];
      c.reservations = [reservation(2, 1, 2, 1), reservation(2, 1, 2, 2), reservation(2, 1, 2, 3)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 2, tours: [1, 2, 3] }]);
  });

  test('deux titres de la même personne à des tours différents : l’union de ses tours, croissante', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1), titre(3, 2)];
      c.reservations = [reservation(1, 3, 2, 3), reservation(1, 1, 1, 1)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 1, tours: [1, 3] }]);
  });

  test('deux titres à la même place, pourvus par la même réservation : chaque tour une seule fois', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(2, 1, 'Accueil'), titre(2, 1, 'Animation')];
      c.reservations = [reservation(5, 2, 1)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 5, tours: [1, 2, 3] }]);
  });

  test('une table à deux titres pourvus : deux animateurs aux mêmes tours', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1), titre(1, 2)];
      c.reservations = [reservation(1, 1, 1), reservation(3, 1, 2, 2)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 1, tours: [1, 2, 3] }, { id: 3, tours: [2] }]);
  });

  test('une personne exclue n’anime pas : sa réservation est suspendue', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1), titre(2, 1)];
      c.reservations = [reservation(1, 1, 1), reservation(2, 2, 1)];
      c.participants[0].exclu = true;
    });
    assert.deepEqual(animateursDe(charge), [{ id: 2, tours: [1, 2, 3] }]);
  });

  test('une animatrice absente au tour 3 n’y anime pas : son anime ne porte pas 3, et la place titrée revient à qui la réserve ce tour-là', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1)];
      c.reservations = [reservation(1, 1, 1), reservation(2, 1, 1, 3)];
      c.participants[0].presence = [1, 2];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 1, tours: [1, 2] }, { id: 2, tours: [3] }]);
    const configuration = configurationDe(charge);
    assert.deepEqual(configuration.participants.slice(0, 2).map(({ id, presence, anime }) => [id, presence, anime]), [
      [1, [1, 2], [1, 2]],
      [2, undefined, [3]],
    ]);
  });

  test('sans sièges attribués, une réservation sans siège à une table titrée pourvoit le titre ; avec, elle ne le pourvoit pas (A8)', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(3, 2)];
      c.reservations = [reservation(4, 3, null)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 4, tours: [1, 2, 3] }]);
    charge.reglages.attribuerSieges = true;
    assert.deepEqual(animateursDe(charge), []);
  });

  test('deux ancrés sans siège pour un titre : un seul animateur par titre, celui que la règle des titres désigne', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 4)];
      c.reservations = [reservation(5, 1, null), reservation(2, 1, null)];
    });
    assert.deepEqual(animateursDe(charge), [{ id: 2, tours: [1, 2, 3] }]);
  });

  test('les animateurs vont par identifiant croissant, quel que soit l’ordre des titres et des réservations', () => {
    const modifier = (c) => {
      c.titres = [titre(3, 1), titre(1, 1), titre(2, 2)];
      c.reservations = [reservation(5, 1, 1), reservation(1, 3, 1, 3), reservation(3, 2, 2, 1)];
    };
    const attendu = [{ id: 1, tours: [3] }, { id: 3, tours: [1] }, { id: 5, tours: [1, 2, 3] }];
    assert.deepEqual(animateursDe(chargeDe(modifier)), attendu);
    const renversee = chargeDe(modifier);
    renversee.titres.reverse();
    renversee.reservations.reverse();
    assert.deepEqual(animateursDe(renversee), attendu);
  });
});

describe('configurationDe : la configuration du stockage, plus les tours animés (contrat de données)', () => {
  test('chaque animateur porte anime, ses tours ; les autres participants et le reste de la configuration sont ceux du stockage', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1), titre(2, 1)];
      c.reservations = [reservation(2, 1, 1, 3), reservation(4, 2, 1), reservation(5, 3, 2)];
      c.participants[2].etiquettes = ['finance'];
    });
    const configuration = configurationDe(charge);
    assert.deepEqual(configuration.participants.map(({ id, anime }) => [id, anime]), [
      [1, undefined],
      [2, [3]],
      [3, undefined],
      [4, [1, 2, 3]],
      [5, undefined],
    ]);
    assert.ok(configuration.participants.every((p) => p.anime !== undefined || !Object.hasOwn(p, 'anime')));
    const sansAnime = {
      ...configuration,
      participants: configuration.participants.map(({ anime, ...reste }) => reste),
    };
    assert.deepEqual(sansAnime, configurationDepuisCharge(charge));
    assert.deepEqual(Object.keys(configuration.participants[1]), ['id', 'nom', 'appartenance', 'exclu', 'anime']);
  });

  test('sans titre pourvu, elle égale celle du stockage', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1)];
      c.reservations = [reservation(1, 2, 1)];
    });
    assert.deepEqual(configurationDe(charge), configurationDepuisCharge(charge));
  });

  test('la charge reste intacte, et deux configurations ne partagent aucune liste de tours', () => {
    const charge = chargeDe((c) => {
      c.titres = [titre(1, 1)];
      c.reservations = [reservation(1, 1, 1)];
    });
    const avant = structuredClone(charge);
    const premiere = configurationDe(charge);
    premiere.participants[0].anime.push(9);
    assert.deepEqual(configurationDe(charge).participants[0].anime, [1, 2, 3]);
    assert.deepEqual(charge, avant);
  });

  test('les quatre démonstrations : la configuration du stockage, plus anime — 33 personnes à [1, 2, 3, 4] dans la grande et sa variante, aucune dans les petites', () => {
    const animateursAttendus = { grande: 33, 'grande-sans-exception': 33, petite: 0, 'petite-conflit': 0 };
    assert.deepEqual(LIVREES.map(({ cle }) => cle).sort(), Object.keys(animateursAttendus).sort());
    for (const { cle, texte } of LIVREES) {
      const { charge } = analyser(texte);
      const configuration = configurationDe(charge);
      const stockage = configurationDepuisCharge(charge);
      assert.deepEqual(Object.keys(configuration), ['participants', 'tables', 'tours', 'reservations', 'contraintes'], cle);
      const animateurs = configuration.participants.filter((p) => Object.hasOwn(p, 'anime'));
      assert.equal(animateurs.length, animateursAttendus[cle], cle);
      assert.ok(animateurs.every(({ anime }) => JSON.stringify(anime) === '[1,2,3,4]'), cle);
      assert.deepEqual(animateurs.map(({ id }) => id), stockage.reservations.map(({ participant }) => participant).sort((a, b) => a - b), cle);
      const sansAnime = { ...configuration, participants: configuration.participants.map(({ anime, ...reste }) => reste) };
      assert.deepEqual(sansAnime, stockage, cle);
    }
  });
});

// Les modules de src/application, hors épreuves, qui nomment
// configurationDepuisCharge, sauf configuration.js : chaque source est
// {chemin, texte}, chemin relatif à src/application.
function appelantsHorsDuPont(sources) {
  return sources
    .filter(({ chemin, texte }) => chemin !== 'configuration.js' && /\bconfigurationDepuisCharge\b/.test(sourceSansCommentaires(texte)))
    .map(({ chemin }) => chemin);
}

// Le texte de la source chemin parmi sources.
const sourceTexte = (chemin, sources) => sources.find((source) => source.chemin === chemin).texte;

// Le texte sans ses commentaires de ligne ni de bloc : un commentaire peut
// nommer la fonction sans l'appeler.
const sourceSansCommentaires = (texte) => texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('garde : configuration.js est le seul appelant de configurationDepuisCharge sous src/application', () => {
  test('aucun autre module, hors épreuves, n’appelle ni n’importe configurationDepuisCharge', () => {
    const racine = fileURLToPath(new URL('.', import.meta.url));
    const sources = readdirSync(racine, { recursive: true })
      .filter((nom) => nom.endsWith('.js') && !nom.endsWith('.test.js'))
      .sort()
      .map((chemin) => ({ chemin, texte: readFileSync(join(racine, chemin), 'utf8') }));
    assert.ok(sources.length > 20, `${sources.length} sources seulement`);
    assert.ok(/\bconfigurationDepuisCharge\(/.test(sourceTexte('configuration.js', sources)), 'configuration.js l’appelle');
    assert.deepEqual(appelantsHorsDuPont(sources), []);
  });

  test('montrée rouge : un module inventé qui l’importe et l’appelle est relevé ; un commentaire qui la nomme ne l’est pas', () => {
    const sources = [
      { chemin: 'configuration.js', texte: 'export const configurationDe = (c) => configurationDepuisCharge(c);\n' },
      { chemin: 'sous/invente.js', texte: "import { configurationDepuisCharge } from '../../stockage/document.js';\nexport const k = (c) => configurationDepuisCharge(c);\n" },
      { chemin: 'commente.js', texte: '// sur configurationDepuisCharge, par configurationDe\n/* configurationDepuisCharge */\nexport const u = "https://exemple.invalid";\n' },
    ];
    assert.deepEqual(appelantsHorsDuPont(sources), ['sous/invente.js']);
  });
});
