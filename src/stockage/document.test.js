// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du document d'événement (§ 4, § 4.5, § 6.1, § 8.1, § 8.8, § 8.9,
// § 9) : la charge neuve ; l'analyse d'un texte, ce qu'elle lit et chacun
// de ses refus, nommé par sa raison et son chemin ; la lecture d'un format
// plus ancien et d'un format plus récent ; les champs facultatifs du format
// 2 et leurs lecteurs ; la configuration que reçoit le moteur ; l'état
// qu'impose le contenu ; la capacité d'une table ; l'erreur de stockage ; le
// parcours de forme que partagent l'analyse, le contrôle des placements et
// les correctifs. Les textes d'épreuve sont du JSON compact : l'analyse ne
// dépend pas de la mise en page. Les noms sont inventés.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { STATUT, normaliser } from '../moteur/configuration.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { HISTORIQUE_PAR_DEFAUT } from '../moteur/recherche.js';
import { texteLivre } from '../demo/livrees.js';
import { VERSION } from '../version.genere.js';
import { serialiser, serialiserCharge } from './canonique.js';
import {
  CIBLE_REDONDANCE_PAR_DEFAUT,
  FORMAT,
  GENERATION_PAR_DEFAUT,
  SCHEMA,
  SIEGES_MAX,
  TOURS_MAX,
  analyser,
  capacite,
  cibleRedondance,
  configurationDepuisCharge,
  creerCharge,
  critereCoche,
  etatDeduit,
  modeObjectifs,
  premiereFaute,
  premiereFauteEnPlace,
  regleObjectifs,
} from './document.js';
import { ErreurStockage } from './erreurs.js';
import { fautes as fautesDePlacement } from './placements.js';

// Un document valide : quatre participants, dont un exclu, l'identifiant 4
// retiré et jamais réattribué ; deux tables, dont une surchargée ; une
// réservation de portée « tous » à siège donné et une de tour désigné sans
// siège ; un titre ; une proposition ; une filiation. Une copie neuve à
// chaque appel, que chaque épreuve abîme à sa façon.
function documentValide() {
  return {
    entete: {
      format: FORMAT,
      produitVersion: VERSION.affichee,
      revision: 12,
      comptes: { participants: 4, tables: 2, reservations: 2, titres: 1, propositions: 1, retenu: 0 },
    },
    charge: {
      evenement: {
        id: 'evt-lucioles',
        nom: 'Veillée des Lucioles',
        date: '2026-11-12',
        siegesParDefaut: 3,
        tours: 2,
        unite: 'cm',
        etat: 'propose',
        filiation: {
          source: { id: 'evt-modele', nom: 'Veillée modèle' },
          instant: { revision: 7, libelle: 'Tables posées' },
        },
      },
      reglages: {
        separerAppartenances: true,
        nouveauxVoisins: false,
        nouvelleTable: true,
        varierAppartenances: false,
        attribuerSieges: false,
        generation: { nombre: 3, arret: 50_000, historique: 500 },
      },
      prochainsIds: { participant: 6, table: 4, proposition: 2 },
      participants: [
        { id: 1, nom: 'Brindille', prenom: 'Anouk', appartenance: 'Chorale du Vallon',
          courriel: 'anouk@exemple.test', titrePressenti: 'animation', notes: null, exclu: false },
        { id: 2, nom: 'Sarrasin', prenom: null, appartenance: 'Chorale du Vallon', courriel: null,
          titrePressenti: null, notes: 'part à 21 h', exclu: false },
        { id: 3, nom: 'Coquelicot', prenom: 'Basile', appartenance: null, courriel: null,
          titrePressenti: null, notes: null, exclu: true },
        { id: 5, nom: 'Mirabelle', prenom: 'Ysé', appartenance: 'Cercle Gamma', courriel: null,
          titrePressenti: null, notes: null, exclu: false },
      ],
      tables: [
        { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
        { id: 3, numero: 2, sieges: 4, forme: 'carree', position: { x: 120.5, y: -40 } },
      ],
      reservations: [
        { participant: 1, table: 3, siege: 4, portee: 'tous', tour: null },
        { participant: 2, table: 1, siege: null, portee: 'tour', tour: 2 },
      ],
      titres: [{ table: 3, siege: 4, libelle: 'animation' }],
      propositions: [
        {
          id: 1,
          graine: 7,
          arret: 50_000,
          historique: 500,
          produitVersion: VERSION.affichee,
          siegesAttribues: false,
          tables: [1, 3],
          capacites: [3, 4],
          tours: 2,
          participants: [1, 2, 5],
          placement: [
            { sieges: [[2, 5], [1]], reserve: [] },
            { sieges: [[2], [1, 5]], reserve: [] },
          ],
        },
      ],
      retenu: null,
    },
  };
}

// Un retenu bien formé pour le document valide.
const retenuValide = () => ({
  proposition: 1,
  siegesAttribues: false,
  tables: [1, 3],
  capacites: [3, 4],
  tours: 2,
  participants: [1, 2, 5],
  placement: [
    { sieges: [[2, 5], [1]], reserve: [] },
    { sieges: [[2], [1, 5]], reserve: [] },
  ],
});

// Texte du document valide, une fois modifier passé sur lui.
function abime(modifier) {
  const copie = documentValide();
  modifier(copie);
  return JSON.stringify(copie);
}

// texte où avant, qui doit y figurer exactement une fois, devient apres :
// pour une valeur que JSON.stringify n'écrit pas. Un remplacement qui ne
// trouve rien échoue au lieu de rendre le texte inchangé.
function remplacerUneFois(texte, avant, apres) {
  assert.equal(texte.split(avant).length, 2, `« ${avant} » doit figurer une fois`);
  return texte.replace(avant, () => apres);
}

// Écart entre ce que fait analyser(texte) et le refus ETAT_ILLISIBLE dont
// les détails sont la raison et le chemin attendus, puis ceux de plus ; null
// quand ils concordent.
function ecartDeRefus(texte, raison, chemin, plus = {}) {
  const attendus = { raison, chemin, ...plus };
  try {
    analyser(texte);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) {
      return `${erreur?.name} au lieu d'une ErreurStockage : ${erreur?.message}`;
    }
    if (erreur.code !== 'ETAT_ILLISIBLE') return `code ${erreur.code} au lieu de ETAT_ILLISIBLE`;
    try {
      assert.deepEqual(erreur.details, attendus);
    } catch {
      return `détails ${JSON.stringify(erreur.details)} au lieu de ${JSON.stringify(attendus)}`;
    }
    return null;
  }
  return 'aucun refus';
}

// Chaque cas [libellé, texte, raison, chemin, détails en plus] dont le refus
// s'écarte de l'attendu, en une ligne lisible.
function ecartsDeRefus(cas) {
  assert.ok(cas.length > 0, 'aucun cas examiné');
  return cas.flatMap(([libelle, texte, raison, chemin, plus]) => {
    const ecart = ecartDeRefus(texte, raison, chemin, plus);
    return ecart === null ? [] : [`${libelle} : ${ecart}`];
  });
}

// Étapes — clés d'objet et rangs de liste — menant à chaque valeur que
// l'analyse examine dans valeur, parents avant enfants, hors de l'intérieur
// des propositions et du retenu, que l'analyse laisse au contrôle des
// placements.
function etapesDe(valeur, prefixe = []) {
  const aPart =
    prefixe.length === 2 && prefixe[0] === 'charge' && (prefixe[1] === 'propositions' || prefixe[1] === 'retenu');
  if (aPart || typeof valeur !== 'object' || valeur === null) return [];
  const suivantes = Array.isArray(valeur) ? valeur.map((_, rang) => rang) : Object.keys(valeur);
  return suivantes.flatMap((etape) => [[...prefixe, etape], ...etapesDe(valeur[etape], [...prefixe, etape])]);
}

// Chemin d'ETAT_ILLISIBLE de ces étapes : clés séparées par un point, rangs
// entre crochets.
const cheminDe = (etapes) =>
  etapes.map((etape, i) => (typeof etape === 'number' ? `[${etape}]` : i === 0 ? etape : `.${etape}`)).join('');

// Valeur au bout de ces étapes dans racine.
const valeurEn = (racine, etapes) => etapes.reduce((valeur, etape) => valeur[etape], racine);

// Chemin de ces étapes, rangs effacés : charge.participants[].nom.
const sansRangs = (etapes) => cheminDe(etapes).replace(/\[\d+\]/g, '[]');

// Chemins, rangs effacés, des valeurs que le contrat de données admet
// nulles. La liste s'écrit d'après le contrat, sans lire le schéma : un
// champ que le schéma rendrait nullable à tort reste ainsi éprouvé.
const ADMETTENT_NULL = new Set([
  'charge.evenement.date',
  'charge.evenement.filiation',
  'charge.participants[].prenom',
  'charge.participants[].appartenance',
  'charge.participants[].courriel',
  'charge.participants[].titrePressenti',
  'charge.participants[].notes',
  'charge.tables[].sieges',
  'charge.reservations[].siege',
  'charge.reservations[].tour',
  'charge.retenu',
]);

// Gèle valeur et tout ce qu'elle contient : une écriture y lève TypeError,
// le module s'exécutant en mode strict.
function geler(valeur) {
  if (typeof valeur === 'object' && valeur !== null) {
    for (const enfant of Object.values(valeur)) geler(enfant);
    Object.freeze(valeur);
  }
  return valeur;
}

describe('ErreurStockage (erreurs.js)', () => {
  test('porte son code et ses détails ; le message les écrit, code puis détails en JSON', () => {
    const erreur = new ErreurStockage('ABSENT', { chemin: 'veillee.gtt.json' });
    assert.ok(erreur instanceof Error);
    assert.equal(erreur.name, 'ErreurStockage');
    assert.equal(erreur.code, 'ABSENT');
    assert.deepEqual(erreur.details, { chemin: 'veillee.gtt.json' });
    assert.equal(erreur.message, 'ABSENT {"chemin":"veillee.gtt.json"}');
    const sansDetails = new ErreurStockage('CORRECTIF');
    assert.deepEqual(sansDetails.details, {});
    assert.equal(sansDetails.message, 'CORRECTIF {}');
  });

  test("le message d'un détail en octets n'en dit que le nombre : les octets d'un fichier entier ne s'écrivent pas dans une trace", () => {
    const octets = new Uint8Array(1 << 20);
    const erreur = new ErreurStockage('LECTURE', { chemin: 'veillee.gtt-journal.jsonl', cause: 'UTF8_INVALIDE', octets });
    assert.equal(erreur.details.octets, octets);
    assert.equal(
      erreur.message,
      'LECTURE {"chemin":"veillee.gtt-journal.jsonl","cause":"UTF8_INVALIDE","octets":"1048576 octets"}',
    );
  });
});

describe('creerCharge (§ 4, § 6.1, § 9)', () => {
  test('une charge neuve est un brouillon sans participant ni table, au format 2, aux réglages par défaut', () => {
    assert.equal(FORMAT, 2);
    const charge = creerCharge({ id: 'evt-neuf', nom: 'Atelier du jeudi', date: '2026-11-12', siegesParDefaut: 8, tours: 3 });
    assert.deepEqual(charge, {
      evenement: {
        id: 'evt-neuf',
        nom: 'Atelier du jeudi',
        date: '2026-11-12',
        siegesParDefaut: 8,
        tours: 3,
        unite: 'cm',
        etat: 'brouillon',
        filiation: null,
      },
      reglages: {
        separerAppartenances: true,
        nouveauxVoisins: true,
        nouvelleTable: true,
        varierAppartenances: true,
        attribuerSieges: false,
        generation: { nombre: 5, arret: 200_000, historique: HISTORIQUE_PAR_DEFAUT },
      },
      prochainsIds: { participant: 1, table: 1, proposition: 1 },
      participants: [],
      tables: [],
      reservations: [],
      titres: [],
      propositions: [],
      retenu: null,
    });
  });

  test("GENERATION_PAR_DEFAUT : cinq propositions de 200 000 mouvements, l'historique par défaut du moteur ; figée, copiée dans chaque charge neuve", () => {
    assert.deepEqual(GENERATION_PAR_DEFAUT, { nombre: 5, arret: 200_000, historique: HISTORIQUE_PAR_DEFAUT });
    assert.ok(Object.isFrozen(GENERATION_PAR_DEFAUT));
    const { generation } = creerCharge({ id: 'evt-neuf', nom: 'Atelier', siegesParDefaut: 8, tours: 3 }).reglages;
    assert.deepEqual(generation, GENERATION_PAR_DEFAUT);
    assert.notEqual(generation, GENERATION_PAR_DEFAUT);
    assert.ok(!Object.isFrozen(generation));
  });

  test('sans date, la date est nulle ; deux charges neuves ne partagent aucun objet', () => {
    const premiere = creerCharge({ id: 'evt-a', nom: 'Veillée A', siegesParDefaut: 6, tours: 2 });
    const seconde = creerCharge({ id: 'evt-b', nom: 'Veillée B', siegesParDefaut: 6, tours: 2 });
    assert.equal(premiere.evenement.date, null);
    premiere.reglages.generation.nombre = 9;
    premiere.prochainsIds.participant = 2;
    premiere.participants.push({ id: 1 });
    assert.equal(seconde.reglages.generation.nombre, 5);
    assert.equal(seconde.prochainsIds.participant, 1);
    assert.deepEqual(seconde.participants, []);
  });

  test("une charge neuve s'écrit, se relit à l'identique, et son état déduit est brouillon", () => {
    const charge = creerCharge({ id: 'evt-neuf', nom: 'Atelier du jeudi', siegesParDefaut: 8, tours: 3 });
    const lecture = analyser(serialiser(charge, { revision: 1, produitVersion: VERSION.affichee }));
    assert.deepEqual(lecture.charge, charge);
    assert.equal(lecture.formatPlusRecent, false);
    assert.equal(etatDeduit(lecture.charge), 'brouillon');
  });
});

describe('analyser : ce qui se lit (§ 8.8)', () => {
  test('le document valide se lit : son en-tête et sa charge tels que le texte les porte, au format courant', () => {
    const { entete, charge } = documentValide();
    assert.deepEqual(analyser(JSON.stringify(documentValide())), {
      entete,
      charge,
      formatPlusRecent: false,
      manquants: { propositions: 0, retenu: false },
    });
  });

  test('variantes admises : chacune se lit sans refus', () => {
    const variantes = [
      ['date nulle', abime((d) => { d.charge.evenement.date = null; })],
      ["29 février d'une année bissextile", abime((d) => { d.charge.evenement.date = '2024-02-29'; })],
      ['29 février 2000, séculaire divisible par 400', abime((d) => { d.charge.evenement.date = '2000-02-29'; })],
      ['31 décembre', abime((d) => { d.charge.evenement.date = '2026-12-31'; })],
      ['filiation nulle', abime((d) => { d.charge.evenement.filiation = null; })],
      ['table de deux sièges', abime((d) => {
        d.charge.tables[1].sieges = 2;
        d.charge.reservations[0].siege = 2;
        d.charge.titres[0].siege = 1;
      })],
      ["réservation d'une personne exclue", abime((d) => {
        d.charge.reservations.push({ participant: 3, table: 1, siege: null, portee: 'tous', tour: null });
        d.entete.comptes.reservations = 3;
      })],
      ['réservation au dernier tour', abime((d) => { d.charge.reservations[1].tour = 2; })],
      ["texte précédé d'une marque d'ordre d'octets", `\uFEFF${JSON.stringify(documentValide())}`],
      ['texte mis en page autrement', JSON.stringify(documentValide(), null, 4)],
      ["propositions fautives, que l'analyse ne contrôle pas", abime((d) => {
        const [premiere] = d.charge.propositions;
        d.charge.propositions.push(42, { id: 1, inconnue: true }, { ...premiere, placement: [{ sieges: [[9]] }] });
        d.entete.comptes.propositions = 4;
      })],
      ['retenu quelconque', abime((d) => {
        d.charge.retenu = { inconnue: [] };
        d.entete.comptes.retenu = 1;
      })],
      // Un identifiant de proposition qui n'en est pas un ne s'attribue pas :
      // il ne se compare pas à prochainsIds.proposition, et le contrôle des
      // placements écarte la proposition ou signale le retenu.
      ["identifiants de proposition qui n'en sont pas, au-delà de prochainsIds.proposition", abime((d) => {
        d.charge.propositions.push(null, { id: 'neuf' }, { id: 9.5 }, { id: 2 ** 31 }, { id: 2 ** 53 }, [9]);
        d.entete.comptes.propositions = 7;
        d.charge.retenu = { ...retenuValide(), proposition: '9' };
        d.entete.comptes.retenu = 1;
      })],
      ['deux propositions de même identifiant, sous prochainsIds.proposition', abime((d) => {
        d.charge.propositions.push({ ...d.charge.propositions[0], graine: 8 });
        d.entete.comptes.propositions = 2;
      })],
      ['retenu bien formé', abime((d) => {
        d.charge.retenu = retenuValide();
        d.entete.comptes.retenu = 1;
      })],
      ['compteurs au plus grand identifiant, 2^31 − 1, et une personne juste en deçà', abime((d) => {
        d.charge.prochainsIds = { participant: 2 ** 31 - 1, table: 2 ** 31 - 1, proposition: 2 ** 31 - 1 };
        d.charge.participants[3].id = 2 ** 31 - 2;
      })],
      ['toutes les listes vides', abime((d) => {
        for (const cle of ['participants', 'tables', 'reservations', 'titres', 'propositions']) {
          d.charge[cle] = [];
          d.entete.comptes[cle] = 0;
        }
      })],
    ];
    const refusees = variantes.flatMap(([libelle, texte]) => {
      try {
        analyser(texte);
        return [];
      } catch (erreur) {
        return [`${libelle} : ${erreur.message}`];
      }
    });
    assert.deepEqual(refusees, []);
  });
});

describe('analyser : les refus que le plan nomme (§ 8.8)', () => {
  test('vide, JSON, clé inconnue, identifiant égal à prochainsIds, comptes, référence, format 0 : chacun avec sa raison et son chemin', () => {
    assert.deepEqual(ecartsDeRefus([
      ['texte vide', '', 'VIDE', null],
      ['« { »', '{', 'JSON', null],
      ['clé inconnue dans un participant',
        abime((d) => { d.charge.participants[1].surnom = 'Sasa'; }), 'FORME', 'charge.participants[1].surnom'],
      ['identifiant de participant égal à prochainsIds.participant',
        abime((d) => { d.charge.participants[3].id = 6; }), 'FORME', 'charge.participants[3].id'],
      ['comptes faux',
        abime((d) => { d.entete.comptes.participants = 5; }), 'COMPTES', 'entete.comptes.participants'],
      ['réservation vers la personne 9, absente',
        abime((d) => { d.charge.reservations[0].participant = 9; }), 'REFERENCE', 'charge.reservations[0].participant'],
      ['format 0', abime((d) => { d.entete.format = 0; }), 'FORMAT_INCONNU', 'entete.format'],
    ]), []);
  });
});

describe('analyser : les bornes des places et des tours, et un titre par place et par libellé (§ 6.2, § 4.1)', () => {
  test('SIEGES_MAX places et TOURS_MAX tours se lisent ; un de plus, au défaut, à une table ou aux tours, est FORME à son chemin', () => {
    assert.equal(SIEGES_MAX, 1000);
    assert.equal(TOURS_MAX, 100);
    const admis = [
      abime((d) => { d.charge.evenement.siegesParDefaut = SIEGES_MAX; }),
      abime((d) => { d.charge.tables[1].sieges = SIEGES_MAX; }),
      abime((d) => { d.charge.evenement.tours = TOURS_MAX; }),
    ];
    for (const texte of admis) assert.doesNotThrow(() => analyser(texte));
    assert.deepEqual(ecartsDeRefus([
      ['défaut au-delà', abime((d) => { d.charge.evenement.siegesParDefaut = SIEGES_MAX + 1; }), 'FORME', 'charge.evenement.siegesParDefaut'],
      ['table au-delà', abime((d) => { d.charge.tables[1].sieges = SIEGES_MAX + 1; }), 'FORME', 'charge.tables[1].sieges'],
      ['tours au-delà', abime((d) => { d.charge.evenement.tours = TOURS_MAX + 1; }), 'FORME', 'charge.evenement.tours'],
      ['défaut à 2^32', abime((d) => { d.charge.evenement.siegesParDefaut = 2 ** 32; }), 'FORME', 'charge.evenement.siegesParDefaut'],
    ]), []);
  });

  test('deux titres identiques à une même place sont FORME au second ; deux libellés distincts à la même place se lisent', () => {
    const doublon = { table: 3, siege: 4, libelle: 'animation' };
    assert.deepEqual(ecartsDeRefus([
      ['titre répété', abime((d) => {
        d.charge.titres.push({ ...doublon });
        d.entete.comptes.titres = 2;
      }), 'FORME', 'charge.titres[1]'],
      ['titre répété, rangé avant un autre', abime((d) => {
        d.charge.titres = [{ ...doublon }, { table: 1, siege: 1, libelle: 'accueil' }, { ...doublon }];
        d.entete.comptes.titres = 3;
      }), 'FORME', 'charge.titres[2]'],
    ]), []);
    assert.doesNotThrow(() => analyser(abime((d) => {
      d.charge.titres.push({ ...doublon, libelle: 'accueil' });
      d.entete.comptes.titres = 2;
    })));
  });
});

describe('analyser : texte vide, JSON, racine et format', () => {
  test('chaque refus porte sa raison et son chemin ; null quand aucun élément ne se désigne', () => {
    const valide = JSON.stringify(documentValide());
    assert.deepEqual(ecartsDeRefus([
      ['blancs seuls', ' \n\t\r\n ', 'VIDE', null],
      ["marque d'ordre d'octets suivie de blancs", '\uFEFF \n', 'VIDE', null],
      ['texte tronqué', valide.slice(0, -20), 'JSON', null],
      ['deux documents à la suite', `${valide}${valide}`, 'JSON', null],
      ['racine qui est une liste', '[]', 'FORME', ''],
      ['racine nulle', 'null', 'FORME', ''],
      ['racine qui est un nombre', '3', 'FORME', ''],
      ['en-tête absent', abime((d) => { delete d.entete; }), 'FORME', 'entete'],
      ['en-tête qui est un nombre', abime((d) => { d.entete = 1; }), 'FORME', 'entete'],
      ['format absent', abime((d) => { delete d.entete.format; }), 'FORME', 'entete.format'],
      ['format négatif', abime((d) => { d.entete.format = -1; }), 'FORMAT_INCONNU', 'entete.format'],
      ['format non entier', abime((d) => { d.entete.format = 1.5; }), 'FORMAT_INCONNU', 'entete.format'],
      ['format en texte', abime((d) => { d.entete.format = '1'; }), 'FORMAT_INCONNU', 'entete.format'],
      ['format nul', abime((d) => { d.entete.format = null; }), 'FORMAT_INCONNU', 'entete.format'],
    ]), []);
  });
});

describe('analyser : forme (§ 8.8)', () => {
  test('chaque clé du contrat, retirée, est nommée par son chemin', () => {
    const etapes = etapesDe(documentValide()).filter((e) => typeof e.at(-1) === 'string');
    assert.ok(etapes.length >= 100, `${etapes.length} clés seulement`);
    assert.deepEqual(ecartsDeRefus(etapes.map((e) => [
      `sans ${cheminDe(e)}`,
      abime((d) => { delete valeurEn(d, e.slice(0, -1))[e.at(-1)]; }),
      'FORME',
      cheminDe(e),
    ])), []);
  });

  test('une clé inconnue, dans chaque objet que le contrat décrit, racine comprise, est nommée par son chemin', () => {
    const objets = [[], ...etapesDe(documentValide())].filter((e) => {
      const valeur = valeurEn(documentValide(), e);
      return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
    });
    assert.ok(objets.length >= 20, `${objets.length} objets seulement`);
    assert.deepEqual(ecartsDeRefus(objets.map((e) => [
      `inconnue sous ${cheminDe(e) || 'la racine'}`,
      abime((d) => { valeurEn(d, e).inconnue = 1; }),
      'FORME',
      cheminDe([...e, 'inconnue']),
    ])), []);
  });

  test("chaque valeur remplacée par une valeur d'une autre sorte est nommée par son chemin", () => {
    // Une liste devient un objet, toute autre valeur une liste : aucune règle
    // du contrat n'admet l'un pour l'autre. Le format, lu avant tout le reste,
    // a sa propre raison.
    const etapes = etapesDe(documentValide());
    assert.deepEqual(ecartsDeRefus(etapes.map((e) => {
      const chemin = cheminDe(e);
      return [
        `${chemin} d'une autre sorte`,
        abime((d) => {
          const porteur = valeurEn(d, e.slice(0, -1));
          porteur[e.at(-1)] = Array.isArray(porteur[e.at(-1)]) ? {} : [];
        }),
        chemin === 'entete.format' ? 'FORMAT_INCONNU' : 'FORME',
        chemin,
      ];
    })), []);
  });

  test('chaque valeur hors de son domaine est nommée par son chemin', () => {
    const cas = [
      ['produitVersion vide', (d) => { d.entete.produitVersion = ''; }, 'entete.produitVersion'],
      ['révision 0', (d) => { d.entete.revision = 0; }, 'entete.revision'],
      ['révision non entière', (d) => { d.entete.revision = 2.5; }, 'entete.revision'],
      ['compte négatif', (d) => { d.entete.comptes.titres = -1; }, 'entete.comptes.titres'],
      ['compte de retenu 2', (d) => { d.entete.comptes.retenu = 2; }, 'entete.comptes.retenu'],
      ["identifiant d'événement vide", (d) => { d.charge.evenement.id = ''; }, 'charge.evenement.id'],
      ["nom d'événement vide", (d) => { d.charge.evenement.nom = ''; }, 'charge.evenement.nom'],
      ['30 février', (d) => { d.charge.evenement.date = '2026-02-30'; }, 'charge.evenement.date'],
      ["29 février d'une année ordinaire", (d) => { d.charge.evenement.date = '2026-02-29'; }, 'charge.evenement.date'],
      ['29 février 1900, séculaire', (d) => { d.charge.evenement.date = '1900-02-29'; }, 'charge.evenement.date'],
      ['31 avril', (d) => { d.charge.evenement.date = '2026-04-31'; }, 'charge.evenement.date'],
      ['mois 13', (d) => { d.charge.evenement.date = '2026-13-01'; }, 'charge.evenement.date'],
      ['mois 00', (d) => { d.charge.evenement.date = '2026-00-10'; }, 'charge.evenement.date'],
      ['jour 00', (d) => { d.charge.evenement.date = '2026-11-00'; }, 'charge.evenement.date'],
      ['date dans un autre ordre', (d) => { d.charge.evenement.date = '12/11/2026'; }, 'charge.evenement.date'],
      ['date suivie d\'une heure', (d) => { d.charge.evenement.date = '2026-11-12T19:00'; }, 'charge.evenement.date'],
      ['date vide', (d) => { d.charge.evenement.date = ''; }, 'charge.evenement.date'],
      ['un seul siège par défaut', (d) => { d.charge.evenement.siegesParDefaut = 1; }, 'charge.evenement.siegesParDefaut'],
      ['aucun tour', (d) => { d.charge.evenement.tours = 0; }, 'charge.evenement.tours'],
      ['unité autre que le centimètre', (d) => { d.charge.evenement.unite = 'mm'; }, 'charge.evenement.unite'],
      ['état inconnu', (d) => { d.charge.evenement.etat = 'archive'; }, 'charge.evenement.etat'],
      ['source de filiation sans nom', (d) => { d.charge.evenement.filiation.source.nom = ''; },
        'charge.evenement.filiation.source.nom'],
      ['instant de filiation à la révision 0', (d) => { d.charge.evenement.filiation.instant.revision = 0; },
        'charge.evenement.filiation.instant.revision'],
      ['réglage non booléen', (d) => { d.charge.reglages.attribuerSieges = 'non'; }, 'charge.reglages.attribuerSieges'],
      ["compte d'arrêt nul", (d) => { d.charge.reglages.generation.arret = 0; }, 'charge.reglages.generation.arret'],
      ['aucune proposition demandée', (d) => { d.charge.reglages.generation.nombre = 0; },
        'charge.reglages.generation.nombre'],
      ['historique de longueur 0', (d) => { d.charge.reglages.generation.historique = 0; },
        'charge.reglages.generation.historique'],
      ['prochain identifiant 0', (d) => { d.charge.prochainsIds.participant = 0; }, 'charge.prochainsIds.participant'],
      ['prochain identifiant de table 0', (d) => { d.charge.prochainsIds.table = 0; }, 'charge.prochainsIds.table'],
      ['prochain identifiant de proposition 0', (d) => { d.charge.prochainsIds.proposition = 0; },
        'charge.prochainsIds.proposition'],
      ['identifiant 0', (d) => { d.charge.participants[0].id = 0; }, 'charge.participants[0].id'],
      ['identifiant en texte', (d) => { d.charge.participants[0].id = '1'; }, 'charge.participants[0].id'],
      // Un identifiant, et chaque compteur qui en est le prochain, reste sous
      // 2^31 ; une référence vers un identifiant au-delà sort de sa règle
      // avant de désigner quoi que ce soit. L'identifiant d'un participant
      // ou d'une table, l'analyse le compare aussi à son compteur, qui le
      // tient déjà sous 2^31 − 1, sous le même chemin : sa règle s'éprouve
      // là où rien ne le compare au compteur, dans les poses d'un correctif
      // (correctifs.test.js).
      ['prochain identifiant à 2^31', (d) => { d.charge.prochainsIds.participant = 2 ** 31; },
        'charge.prochainsIds.participant'],
      ['prochain identifiant de table à 2^31', (d) => { d.charge.prochainsIds.table = 2 ** 31; },
        'charge.prochainsIds.table'],
      ['prochain identifiant de proposition à 2^31', (d) => { d.charge.prochainsIds.proposition = 2 ** 31; },
        'charge.prochainsIds.proposition'],
      ['réservation de la personne 2^31', (d) => { d.charge.reservations[0].participant = 2 ** 31; },
        'charge.reservations[0].participant'],
      ['réservation de la table 2^31', (d) => { d.charge.reservations[1].table = 2 ** 31; },
        'charge.reservations[1].table'],
      ['titre de la table 2^31', (d) => { d.charge.titres[0].table = 2 ** 31; }, 'charge.titres[0].table'],
      ['révision au-delà des entiers exacts', (d) => { d.entete.revision = 2 ** 53; }, 'entete.revision'],
      ['nom de participant vide', (d) => { d.charge.participants[1].nom = ''; }, 'charge.participants[1].nom'],
      ['prénom vide au lieu de null', (d) => { d.charge.participants[1].prenom = ''; }, 'charge.participants[1].prenom'],
      ['notes vides au lieu de null', (d) => { d.charge.participants[2].notes = ''; }, 'charge.participants[2].notes'],
      ['courriel numérique', (d) => { d.charge.participants[0].courriel = 42; }, 'charge.participants[0].courriel'],
      ['exclu en texte', (d) => { d.charge.participants[2].exclu = 'oui'; }, 'charge.participants[2].exclu'],
      ['exclu nul', (d) => { d.charge.participants[2].exclu = null; }, 'charge.participants[2].exclu'],
      ['numéro de table 0', (d) => { d.charge.tables[0].numero = 0; }, 'charge.tables[0].numero'],
      ['table d\'un seul siège', (d) => { d.charge.tables[1].sieges = 1; }, 'charge.tables[1].sieges'],
      ['sièges non entiers', (d) => { d.charge.tables[1].sieges = 3.5; }, 'charge.tables[1].sieges'],
      ['forme inconnue', (d) => { d.charge.tables[0].forme = 'ovale'; }, 'charge.tables[0].forme'],
      ['position en texte', (d) => { d.charge.tables[0].position.x = '0'; }, 'charge.tables[0].position.x'],
      ['position nulle', (d) => { d.charge.tables[1].position.y = null; }, 'charge.tables[1].position.y'],
      ['portée inconnue', (d) => { d.charge.reservations[0].portee = 'toujours'; }, 'charge.reservations[0].portee'],
      ['siège réservé 0', (d) => { d.charge.reservations[0].siege = 0; }, 'charge.reservations[0].siege'],
      ['tour 0', (d) => { d.charge.reservations[1].tour = 0; }, 'charge.reservations[1].tour'],
      ['libellé de titre vide', (d) => { d.charge.titres[0].libelle = ''; }, 'charge.titres[0].libelle'],
      ['titre sans siège', (d) => { d.charge.titres[0].siege = null; }, 'charge.titres[0].siege'],
    ];
    assert.deepEqual(ecartsDeRefus(cas.map(([libelle, modifier, chemin]) => [libelle, abime(modifier), 'FORME', chemin])), []);
  });

  test("une position que JSON.parse lit infinie, 1e400 ou -1e400, est nommée par son chemin", () => {
    // JSON.stringify n'écrit jamais un nombre infini : le cas s'écrit dans le
    // texte, et l'épreuve vérifie d'abord qu'il se lit bien infini.
    const valide = JSON.stringify(documentValide());
    const cas = [
      ['abscisse 1e400',
        remplacerUneFois(valide, '"position":{"x":0,"y":0}', '"position":{"x":1e400,"y":0}'),
        'FORME', 'charge.tables[0].position.x'],
      ['ordonnée -1e400',
        remplacerUneFois(valide, '"position":{"x":120.5,"y":-40}', '"position":{"x":120.5,"y":-1e400}'),
        'FORME', 'charge.tables[1].position.y'],
    ];
    assert.equal(JSON.parse(cas[0][1]).charge.tables[0].position.x, Infinity);
    assert.equal(JSON.parse(cas[1][1]).charge.tables[1].position.y, -Infinity);
    assert.deepEqual(ecartsDeRefus(cas), []);
  });

  test("null, posé à chaque valeur dont le contrat ne l'admet pas, est nommé par son chemin", () => {
    const etapes = etapesDe(documentValide());
    // Chaque chemin admis nul désigne au moins une valeur du document : la
    // liste suit le contrat, sans entrée qui ne désigne plus rien.
    for (const chemin of ADMETTENT_NULL) {
      assert.ok(etapes.some((e) => sansRangs(e) === chemin), `${chemin} : aucune valeur du document`);
    }
    const refusent = etapes.filter((e) => !ADMETTENT_NULL.has(sansRangs(e)));
    assert.ok(refusent.length >= 80, `${refusent.length} valeurs seulement`);
    // Le format, lu avant tout le reste, a sa propre raison.
    assert.deepEqual(ecartsDeRefus(refusent.map((e) => {
      const chemin = cheminDe(e);
      return [
        `${chemin} nul`,
        abime((d) => { valeurEn(d, e.slice(0, -1))[e.at(-1)] = null; }),
        chemin === 'entete.format' ? 'FORMAT_INCONNU' : 'FORME',
        chemin,
      ];
    })), []);
  });

  test("de plusieurs clés inconnues, la plus petite en unités UTF-16 est nommée, quel que soit l'ordre où elles arrivent", () => {
    const avec = (cles) => abime((d) => {
      for (const cle of cles) d.charge.participants[1][cle] = 1;
    });
    // Une clé « __proto__ » ne s'écrit que dans le texte : une affectation en
    // JavaScript changerait le prototype au lieu d'ajouter une clé.
    const avecProto = JSON.stringify(documentValide()).replace('"nom":"Sarrasin"', '"nom":"Sarrasin","__proto__":{}');
    assert.deepEqual(ecartsDeRefus([
      ['zeta puis alpha', avec(['zeta', 'alpha']), 'FORME', 'charge.participants[1].alpha'],
      ['alpha puis zeta', avec(['alpha', 'zeta']), 'FORME', 'charge.participants[1].alpha'],
      ['une majuscule précède une minuscule', avec(['alpha', 'Zeta']), 'FORME', 'charge.participants[1].Zeta'],
      ["une clé qui n'est pas un identifiant", avec(['nom complet']), 'FORME', 'charge.participants[1]["nom complet"]'],
      ['une clé vide', avec(['']), 'FORME', 'charge.participants[1][""]'],
      ['une clé entière', avec(['7']), 'FORME', 'charge.participants[1]["7"]'],
      ['une clé « __proto__ »', avecProto, 'FORME', 'charge.participants[1].__proto__'],
    ]), []);
  });
});

describe('analyser : identifiants et tours (§ 4)', () => {
  test('un identifiant en double, ou atteignant prochainsIds, est nommé ; un tour hors de sa portée aussi', () => {
    assert.deepEqual(ecartsDeRefus([
      ['identifiant de participant au-delà de prochainsIds',
        abime((d) => { d.charge.participants[3].id = 9; }), 'FORME', 'charge.participants[3].id'],
      ['identifiant de participant en double, le second fautif',
        abime((d) => { d.charge.participants[2].id = 1; }), 'FORME', 'charge.participants[2].id'],
      ['identifiant de table égal à prochainsIds.table',
        abime((d) => { d.charge.tables[1].id = 4; }), 'FORME', 'charge.tables[1].id'],
      ['identifiant de table en double',
        abime((d) => { d.charge.tables[1].id = 1; }), 'FORME', 'charge.tables[1].id'],
      ['portée « tous » avec un tour',
        abime((d) => { d.charge.reservations[0].tour = 1; }), 'FORME', 'charge.reservations[0].tour'],
      ['portée « tour » sans tour',
        abime((d) => { d.charge.reservations[1].tour = null; }), 'FORME', 'charge.reservations[1].tour'],
      ['tour au-delà du nombre de tours',
        abime((d) => { d.charge.reservations[1].tour = 3; }), 'FORME', 'charge.reservations[1].tour'],
    ]), []);
  });

  test("l'identifiant d'une proposition et la proposition d'origine du retenu ne se comparent pas à prochainsIds.proposition : le fichier se lit tel qu'écrit, au format courant comme plus récent, et le contrôle des placements les juge (§ 8.9, point 3)", () => {
    // La proposition 1 est seule, et prochainsIds.proposition vaut 2.
    const avecRetenu = (proposition) => (d) => {
      d.charge.retenu = { ...retenuValide(), proposition };
      d.entete.comptes.retenu = 1;
    };
    const seconde = (id) => (d) => {
      d.charge.propositions.push({ ...d.charge.propositions[0], id });
      d.entete.comptes.propositions = 2;
    };
    const cas = [
      ['identifiant de proposition égal à prochainsIds.proposition', (d) => { d.charge.propositions[0].id = 2; }],
      ['identifiant de proposition au-delà de prochainsIds.proposition', (d) => { d.charge.propositions[0].id = 7; }],
      ['la seconde proposition au-delà, la première en deçà', seconde(3)],
      ["proposition d'origine du retenu égale à prochainsIds.proposition", avecRetenu(2)],
      ["proposition d'origine du retenu au-delà, sans aucune proposition", (d) => {
        avecRetenu(5)(d);
        d.charge.propositions = [];
        d.entete.comptes.propositions = 0;
      }],
      ['compteur abaissé à 1, sous chaque identifiant et sous le retenu', (d) => {
        avecRetenu(1)(d);
        seconde(3)(d);
        d.charge.prochainsIds.proposition = 1;
      }],
    ];
    // Chaque cas se lit à chaque format, l'en-tête et la charge rendus tels
    // que le document les porte.
    const ecarts = cas.flatMap(([libelle, modifier]) =>
      [FORMAT, FORMAT + 1].flatMap((format) => {
        const attendu = documentValide();
        modifier(attendu);
        attendu.entete.format = format;
        try {
          assert.deepEqual(analyser(JSON.stringify(attendu)), {
            ...attendu,
            formatPlusRecent: format > FORMAT,
            manquants: { propositions: 0, retenu: false },
          });
          return [];
        } catch (erreur) {
          return [`${libelle}, format ${format} : ${erreur.message.split('\n')[0]}`];
        }
      }),
    );
    assert.ok(cas.length > 0, 'aucun cas examiné');
    assert.deepEqual(ecarts, []);
    // Un identifiant de table en double reste refusé, quels que soient ceux
    // des propositions.
    assert.deepEqual(ecartsDeRefus([
      ['une table en double, une proposition au-delà du compteur', abime((d) => {
        seconde(3)(d);
        d.charge.tables[1].id = 1;
      }), 'FORME', 'charge.tables[1].id'],
    ]), []);
  });
});

describe('analyser : comptes de l\'en-tête (§ 8.8)', () => {
  test('les comptes de la saisie — participants, tables, réservations, titres — se comparent à leur liste et refusent le fichier', () => {
    assert.deepEqual(ecartsDeRefus([
      ['un participant perdu', abime((d) => { d.charge.participants.pop(); }), 'COMPTES', 'entete.comptes.participants'],
      ['une table annoncée en trop', abime((d) => { d.entete.comptes.tables = 3; }), 'COMPTES', 'entete.comptes.tables'],
      ['une réservation annoncée en moins',
        abime((d) => { d.entete.comptes.reservations = 1; }), 'COMPTES', 'entete.comptes.reservations'],
      ['un titre annoncé en trop', abime((d) => { d.entete.comptes.titres = 2; }), 'COMPTES', 'entete.comptes.titres'],
    ]), []);
  });

  test("les comptes des propositions et du retenu ne refusent jamais le fichier (§ 8.9, point 3) : manquants rend les propositions annoncées au-delà de la liste et le retenu annoncé absent ; une liste plus longue que son compte se lit telle quelle", () => {
    const manquantsDe = (modifier) => analyser(abime(modifier)).manquants;
    assert.deepEqual(manquantsDe(() => {}), { propositions: 0, retenu: false });
    assert.deepEqual(manquantsDe((d) => { d.charge.propositions = []; }), { propositions: 1, retenu: false });
    assert.deepEqual(manquantsDe((d) => { d.entete.comptes.propositions = 3; }), { propositions: 2, retenu: false });
    assert.deepEqual(manquantsDe((d) => { d.entete.comptes.retenu = 1; }), { propositions: 0, retenu: true });
    assert.deepEqual(manquantsDe((d) => { d.entete.comptes.propositions = 0; }), { propositions: 0, retenu: false });
    const retenuNonAnnonce = analyser(abime((d) => { d.charge.retenu = retenuValide(); }));
    assert.deepEqual(retenuNonAnnonce.manquants, { propositions: 0, retenu: false });
    assert.deepEqual(retenuNonAnnonce.charge.retenu, retenuValide());
    // Au format plus récent de même.
    const plusRecent = analyser(abime((d) => {
      d.entete.format = FORMAT + 1;
      d.charge.propositions = [];
      d.entete.comptes.retenu = 1;
    }));
    assert.deepEqual(plusRecent.manquants, { propositions: 1, retenu: true });
  });
});

describe('analyser : références (§ 4, § 6.2)', () => {
  test("une réservation ou un titre vers une table ou une personne absente, ou un siège au-delà de la capacité, est nommé", () => {
    assert.deepEqual(ecartsDeRefus([
      ["réservation d'une personne retirée",
        abime((d) => { d.charge.reservations[1].participant = 4; }), 'REFERENCE', 'charge.reservations[1].participant'],
      ['réservation vers une table absente',
        abime((d) => { d.charge.reservations[0].table = 2; }), 'REFERENCE', 'charge.reservations[0].table'],
      ['siège réservé au-delà de la capacité par défaut',
        abime((d) => { d.charge.reservations[1].siege = 4; }), 'REFERENCE', 'charge.reservations[1].siege'],
      ['siège réservé au-delà de la surcharge',
        abime((d) => { d.charge.reservations[0].siege = 5; }), 'REFERENCE', 'charge.reservations[0].siege'],
      ['titre vers une table absente',
        abime((d) => { d.charge.titres[0].table = 7; }), 'REFERENCE', 'charge.titres[0].table'],
      ['titre au-delà de la capacité',
        abime((d) => { d.charge.titres[0].siege = 5; }), 'REFERENCE', 'charge.titres[0].siege'],
    ]), []);
  });
});

describe('analyser : ordre des refus', () => {
  test('format, forme de chaque champ, identifiants et tours, comptes, puis références ; dans chacun, l\'ordre du schéma puis des rangs', () => {
    assert.deepEqual(ecartsDeRefus([
      ['le format avant la forme', abime((d) => {
        d.entete.format = 0;
        d.charge.participants[0].nom = '';
      }), 'FORMAT_INCONNU', 'entete.format'],
      ["l'ordre du schéma dans la forme", abime((d) => {
        d.charge.participants[0].nom = '';
        d.charge.evenement.nom = '';
      }), 'FORME', 'charge.evenement.nom'],
      ['les rangs dans leur ordre', abime((d) => {
        d.charge.participants[2].nom = '';
        d.charge.participants[1].nom = '';
      }), 'FORME', 'charge.participants[1].nom'],
      ["un champ connu avant une clé inconnue du même objet", abime((d) => {
        d.charge.participants[0].alpha = 1;
        d.charge.participants[0].nom = '';
      }), 'FORME', 'charge.participants[0].nom'],
      ['la forme de chaque champ avant les identifiants', abime((d) => {
        d.charge.participants[1].id = 1;
        d.charge.titres[0].libelle = '';
      }), 'FORME', 'charge.titres[0].libelle'],
      ['la forme avant les comptes', abime((d) => {
        d.entete.comptes.participants = 5;
        d.charge.participants[0].nom = '';
      }), 'FORME', 'charge.participants[0].nom'],
      ['les comptes avant les références', abime((d) => {
        d.charge.participants.shift();
      }), 'COMPTES', 'entete.comptes.participants'],
      ['la forme avant les références, même plus loin dans le texte', abime((d) => {
        d.charge.reservations[0].participant = 9;
        d.charge.titres[0].libelle = '';
      }), 'FORME', 'charge.titres[0].libelle'],
    ]), []);
  });
});

describe('analyser : format plus récent (§ 8.8, § 18.6)', () => {
  test("un format plus récent se lit, formatPlusRecent vrai, ses clés inconnues ignorées : ni l'en-tête ni la charge rendus ne les portent", () => {
    const simple = analyser(abime((d) => { d.entete.format = FORMAT + 1; }));
    assert.equal(simple.formatPlusRecent, true);
    assert.equal(simple.entete.format, FORMAT + 1);
    const { entete, charge } = documentValide();
    const etendu = analyser(abime((d) => {
      d.entete.format = FORMAT + 1;
      d.annexe = { couleur: 'vert' };
      d.entete.signature = null;
      d.entete.comptes.lieux = 1;
      d.charge.evenement.lieu = 'Salle des fêtes';
      d.charge.participants[0].pronom = 'elle';
      d.charge.tables[1].position.z = 0;
      d.charge.propositions[0].note = 'refaite';
      d.charge.propositions[0].placement[0].commentaire = 'tour calme';
    }));
    assert.deepEqual(etendu, {
      entete: { ...entete, format: FORMAT + 1 },
      charge,
      formatPlusRecent: true,
      manquants: { propositions: 0, retenu: false },
    });
  });

  test("dans un format plus récent, toute autre faute de forme lève FORMAT_PLUS_RECENT avec le format lu ; comptes et références gardent leur raison et portent le format lu", () => {
    const plusRecent = (format, modifier) => abime((d) => {
      d.entete.format = format;
      d.charge.evenement.lieu = 'Salle des fêtes';
      modifier(d);
    });
    assert.deepEqual(ecartsDeRefus([
      ['état « archive »', plusRecent(FORMAT + 1, (d) => { d.charge.evenement.etat = 'archive'; }),
        'FORMAT_PLUS_RECENT', 'charge.evenement.etat', { format: FORMAT + 1 }],
      ['état « archive », deux formats plus loin', plusRecent(FORMAT + 2, (d) => { d.charge.evenement.etat = 'archive'; }),
        'FORMAT_PLUS_RECENT', 'charge.evenement.etat', { format: FORMAT + 2 }],
      ['nom vide', plusRecent(FORMAT + 1, (d) => { d.charge.participants[0].nom = ''; }),
        'FORMAT_PLUS_RECENT', 'charge.participants[0].nom', { format: FORMAT + 1 }],
      ['clé connue absente', plusRecent(FORMAT + 1, (d) => { delete d.charge.tables[0].forme; }),
        'FORMAT_PLUS_RECENT', 'charge.tables[0].forme', { format: FORMAT + 1 }],
      ['charge qui est une liste', plusRecent(FORMAT + 1, (d) => { d.charge = []; }),
        'FORMAT_PLUS_RECENT', 'charge', { format: FORMAT + 1 }],
      ['identifiant en double', plusRecent(FORMAT + 1, (d) => { d.charge.participants[2].id = 1; }),
        'FORMAT_PLUS_RECENT', 'charge.participants[2].id', { format: FORMAT + 1 }],
      ['tour au-delà du nombre de tours', plusRecent(FORMAT + 1, (d) => { d.charge.reservations[1].tour = 3; }),
        'FORMAT_PLUS_RECENT', 'charge.reservations[1].tour', { format: FORMAT + 1 }],
      ['comptes faux', plusRecent(FORMAT + 1, (d) => { d.entete.comptes.tables = 1; }),
        'COMPTES', 'entete.comptes.tables', { format: FORMAT + 1 }],
      ['référence absente', plusRecent(FORMAT + 1, (d) => { d.charge.titres[0].table = 7; }),
        'REFERENCE', 'charge.titres[0].table', { format: FORMAT + 1 }],
      ['comptes faux, deux formats plus loin', plusRecent(FORMAT + 2, (d) => { d.entete.comptes.titres = 0; }),
        'COMPTES', 'entete.comptes.titres', { format: FORMAT + 2 }],
      ['référence absente, deux formats plus loin', plusRecent(FORMAT + 2, (d) => { d.charge.reservations[1].participant = 4; }),
        'REFERENCE', 'charge.reservations[1].participant', { format: FORMAT + 2 }],
      ['siège au-delà de la capacité', plusRecent(FORMAT + 1, (d) => { d.charge.reservations[1].siege = 4; }),
        'REFERENCE', 'charge.reservations[1].siege', { format: FORMAT + 1 }],
      ['au format courant, la même faute reste FORME',
        abime((d) => { d.charge.evenement.etat = 'archive'; }), 'FORME', 'charge.evenement.etat'],
    ]), []);
  });

  test("une collection qu'un format plus récent ajoute, ignorée à la lecture, laisse une référence ou un compte sans objet : la raison reste REFERENCE ou COMPTES, et les détails portent le format lu", () => {
    // Le format plus récent de l'épreuve range une table d'appoint hors de
    // tables, et une réservation la désigne ; la lecture ne garde que les
    // clés connues.
    const avecAppoint = (modifier) => abime((d) => {
      d.entete.format = FORMAT + 1;
      d.charge.tablesAppoint = [{ id: 4, numero: 3, sieges: 4, forme: 'ronde', position: { x: 0, y: 200 } }];
      d.charge.prochainsIds.table = 5;
      d.charge.reservations.push({ participant: 5, table: 4, siege: 1, portee: 'tous', tour: null });
      d.entete.comptes.reservations = 3;
      modifier(d);
    });
    assert.deepEqual(ecartsDeRefus([
      ["la réservation de la table d'appoint", avecAppoint(() => {}),
        'REFERENCE', 'charge.reservations[2].table', { format: FORMAT + 1 }],
      ["la table d'appoint comptée parmi les tables", avecAppoint((d) => { d.entete.comptes.tables = 3; }),
        'COMPTES', 'entete.comptes.tables', { format: FORMAT + 1 }],
    ]), []);
  });
});

describe('configurationDepuisCharge (§ 6.1)', () => {
  test('une table qui suit le défaut le prend, une table surchargée garde sa valeur, et changer le défaut ne touche pas la surchargée', () => {
    const { charge } = documentValide();
    assert.deepEqual(configurationDepuisCharge(charge).tables, [
      { id: 1, numero: 1, capacite: 3 },
      { id: 3, numero: 2, capacite: 4 },
    ]);
    charge.evenement.siegesParDefaut = 6;
    assert.deepEqual(configurationDepuisCharge(charge).tables.map((table) => table.capacite), [6, 4]);
  });

  test('la configuration porte les participants, les tours, les réservations sans siège et les quatre contraintes', () => {
    assert.deepEqual(configurationDepuisCharge(documentValide().charge), {
      participants: [
        { id: 1, nom: 'Brindille', appartenance: 'Chorale du Vallon', exclu: false },
        { id: 2, nom: 'Sarrasin', appartenance: 'Chorale du Vallon', exclu: false },
        { id: 3, nom: 'Coquelicot', appartenance: null, exclu: true },
        { id: 5, nom: 'Mirabelle', appartenance: 'Cercle Gamma', exclu: false },
      ],
      tables: [
        { id: 1, numero: 1, capacite: 3 },
        { id: 3, numero: 2, capacite: 4 },
      ],
      tours: 2,
      reservations: [
        { participant: 1, table: 3, portee: 'tous' },
        { participant: 2, table: 1, portee: 'tour', tour: 2 },
      ],
      contraintes: {
        separerAppartenances: true,
        nouveauxVoisins: false,
        nouvelleTable: true,
        varierAppartenances: false,
      },
    });
  });

  test("les tables vont par identifiant croissant, l'ordre du texte canonique : une charge aux tables dans le désordre et sa copie canonique donnent la même configuration, donc à graine égale le même plan (§ 8.9)", () => {
    const { charge } = analyser(texteLivre('grande-sans-exception'));
    const desordre = structuredClone(charge);
    [desordre.tables[0], desordre.tables[1]] = [desordre.tables[1], desordre.tables[0]];
    desordre.tables.push(desordre.tables.shift());
    assert.notDeepEqual(desordre.tables.map(({ id }) => id), charge.tables.map(({ id }) => id));
    const canonique = configurationDepuisCharge(charge);
    assert.deepEqual(configurationDepuisCharge(desordre), canonique);
    assert.deepEqual(
      canonique.tables.map(({ id }) => id),
      charge.tables.map(({ id }) => id).sort((a, b) => a - b),
    );
  });

  test("les participants et les réservations gardent l'ordre de la charge : le rang d'une réservation que nomme une ErreurConfiguration est son rang dans la charge", () => {
    const { charge } = documentValide();
    charge.participants.reverse();
    charge.tables.reverse();
    charge.reservations.reverse();
    const configuration = configurationDepuisCharge(charge);
    assert.deepEqual(configuration.participants.map(({ id }) => id), [5, 3, 2, 1]);
    assert.deepEqual(configuration.tables.map(({ id }) => id), [1, 3]);
    assert.deepEqual(configuration.reservations.map(({ participant }) => participant), [2, 1]);
    // La seconde réservation de la charge désigne une table absente : le
    // moteur la nomme à son rang dans la charge, 1.
    charge.reservations[1].table = 9;
    assert.throws(
      () => normaliser(configurationDepuisCharge(charge)),
      (erreur) =>
        erreur instanceof ErreurConfiguration &&
        erreur.code === 'RESERVATION_INCONNUE' &&
        erreur.details.reservation === 1 &&
        erreur.details.table === 9,
    );
  });

  test('le résultat passe normaliser du moteur : exclu écarté, ancrage dérivé de la portée « tous », capacités résolues', () => {
    const charge = geler(documentValide().charge);
    const instance = normaliser(configurationDepuisCharge(charge));
    assert.deepEqual(instance.ids, [1, 2, 5]);
    assert.deepEqual([...instance.exclus], [3]);
    assert.deepEqual(instance.idsTables, [1, 3]);
    assert.deepEqual(instance.capacite, Int32Array.from([3, 4]));
    assert.deepEqual(instance.statut, Uint8Array.from([STATUT.ANCRE, STATUT.PARTIELLEMENT_FIXE, STATUT.MOBILE]));
    assert.equal(instance.R, 2);
  });
});

describe('etatDeduit (§ 8.7, § 9)', () => {
  test('sans proposition, brouillon ; avec, proposé ; avec un retenu, retenu', () => {
    assert.equal(etatDeduit(creerCharge({ id: 'evt-neuf', nom: 'Atelier', siegesParDefaut: 8, tours: 3 })), 'brouillon');
    const { charge } = documentValide();
    assert.equal(etatDeduit(charge), 'propose');
    charge.retenu = retenuValide();
    assert.equal(etatDeduit(charge), 'retenu');
    charge.propositions = [];
    assert.equal(etatDeduit(charge), 'retenu');
  });

  test("un plan bloqué donne l'un des trois, jamais bloqué : le contenu décide, pas l'état inscrit", () => {
    const bloquee = (modifier) => {
      const { charge } = documentValide();
      charge.evenement.etat = 'bloque';
      modifier(charge);
      return etatDeduit(charge);
    };
    assert.deepEqual(
      [
        bloquee((c) => { c.propositions = []; }),
        bloquee(() => {}),
        bloquee((c) => { c.retenu = retenuValide(); }),
      ],
      ['brouillon', 'propose', 'retenu'],
    );
    const { charge } = documentValide();
    charge.evenement.etat = 'retenu';
    charge.propositions = [];
    assert.equal(etatDeduit(charge), 'brouillon');
  });
});

describe('capacite (§ 6.1)', () => {
  test("les sièges de la table, ou le défaut quand elle le suit ; un identifiant au lieu de l'enregistrement lève TypeError", () => {
    const { charge } = documentValide();
    assert.equal(capacite(charge, charge.tables[0]), 3);
    assert.equal(capacite(charge, charge.tables[1]), 4);
    charge.evenement.siegesParDefaut = 10;
    assert.equal(capacite(charge, charge.tables[0]), 10);
    assert.equal(capacite(charge, charge.tables[1]), 4);
    assert.throws(() => capacite(charge, 3), TypeError);
    assert.throws(() => capacite(charge, null), TypeError);
  });
});

describe('premiereFaute : le parcours de forme, sans lever (§ 8.8, § 8.9)', () => {
  test("le chemin de la première faute, ou null ; une règle aPart n'examine que son conteneur sous une autre règle, et tout son contenu donnée pour racine", () => {
    const regleDe = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
    const RETENU = regleDe(regleDe(SCHEMA, 'charge'), 'retenu');
    const valide = documentValide();
    valide.charge.retenu = retenuValide();
    assert.equal(premiereFaute(valide, SCHEMA), null);
    assert.equal(premiereFaute(valide.charge.retenu, RETENU), null);
    const fautif = { ...retenuValide(), tours: 0 };
    valide.charge.retenu = fautif;
    assert.equal(premiereFaute(valide, SCHEMA), null);
    assert.equal(premiereFaute(fautif, RETENU), 'tours');
    assert.equal(premiereFaute(fautif, RETENU, 'charge.retenu'), 'charge.retenu.tours');
    assert.equal(premiereFaute(null, RETENU), null);
    valide.charge.retenu = [];
    assert.equal(premiereFaute(valide, SCHEMA), 'charge.retenu');
  });

  test("premiereFauteEnPlace lit une valeur comme l'analyse la lit à sa place : une règle aPart n'y examine que son conteneur, toute autre comme premiereFaute", () => {
    const regleDe = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
    const CHARGE = regleDe(SCHEMA, 'charge');
    const RETENU = regleDe(CHARGE, 'retenu');
    const PROPOSITIONS = regleDe(CHARGE, 'propositions');
    const EVENEMENT = regleDe(CHARGE, 'evenement');
    const fautif = { ...retenuValide(), tours: 0 };
    assert.equal(premiereFaute(fautif, RETENU), 'tours');
    assert.equal(premiereFauteEnPlace(fautif, RETENU), null);
    assert.equal(premiereFauteEnPlace(null, RETENU), null);
    assert.equal(premiereFauteEnPlace([], RETENU), '');
    assert.equal(premiereFauteEnPlace(5, RETENU, 'charge.retenu'), 'charge.retenu');
    assert.equal(premiereFaute([42], PROPOSITIONS), '[0]');
    assert.equal(premiereFauteEnPlace([42, { id: 'x' }], PROPOSITIONS), null);
    assert.equal(premiereFauteEnPlace({}, PROPOSITIONS), '');
    assert.equal(premiereFauteEnPlace(null, PROPOSITIONS), '');
    const { evenement } = documentValide().charge;
    for (const valeur of [evenement, { ...evenement, nom: '' }, { ...evenement, lieu: 'Salle' }, 5]) {
      assert.equal(premiereFauteEnPlace(valeur, EVENEMENT), premiereFaute(valeur, EVENEMENT), JSON.stringify(valeur));
    }
    assert.equal(premiereFauteEnPlace({ ...evenement, nom: '' }, EVENEMENT, 'charge.evenement'), 'charge.evenement.nom');
  });
});

describe('le marqueur de chaise vide : la règle d\'une liste de table (§ 8.9)', () => {
  // La proposition du document valide, sièges attribués, dont le tour 2
  // laisse vide le siège 2 de la table 3 : sa liste vaut [1, null, 5].
  const propositionAChaiseVide = () => {
    const proposition = documentValide().charge.propositions[0];
    proposition.siegesAttribues = true;
    proposition.placement[1].sieges[1] = [1, null, 5];
    return proposition;
  };

  test("premiereFaute admet null dans une liste de table, d'une proposition comme du retenu, et nulle part ailleurs dans un placement", () => {
    const regleDe = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
    const CHARGE = regleDe(SCHEMA, 'charge');
    const PROPOSITION = regleDe(CHARGE, 'propositions').element;
    const RETENU = regleDe(CHARGE, 'retenu');
    const proposition = propositionAChaiseVide();
    const { id, graine, arret, historique, produitVersion, ...plan } = proposition;
    const retenu = { proposition: id, ...plan };
    assert.equal(premiereFaute(proposition, PROPOSITION), null);
    assert.equal(premiereFaute(retenu, RETENU), null);
    const cas = [
      ['dans une réserve', (p) => { p.placement[0].reserve = [null]; }, 'placement[0].reserve[0]'],
      ['parmi les participants', (p) => { p.participants[1] = null; }, 'participants[1]'],
      ['parmi les tables', (p) => { p.tables[0] = null; }, 'tables[0]'],
      ['parmi les capacités', (p) => { p.capacites[1] = null; }, 'capacites[1]'],
      ['à la place d\'une liste de table', (p) => { p.placement[0].sieges[0] = null; }, 'placement[0].sieges[0]'],
    ];
    assert.ok(cas.length > 0);
    for (const [libelle, abimer, chemin] of cas) {
      const abimee = propositionAChaiseVide();
      abimer(abimee);
      assert.equal(premiereFaute(abimee, PROPOSITION), chemin, libelle);
    }
  });

  test("à la place d'un occupant, 0, 1,5, −1 et 2^31 sont fautifs, comme tout identifiant ; 2^31 − 1 se lit", () => {
    const regleDe = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
    const PROPOSITION = regleDe(regleDe(SCHEMA, 'charge'), 'propositions').element;
    for (const occupant of [0, 1.5, 2 ** 31, -1]) {
      const abimee = propositionAChaiseVide();
      abimee.placement[1].sieges[1][1] = occupant;
      assert.equal(premiereFaute(abimee, PROPOSITION), 'placement[1].sieges[1][1]', String(occupant));
    }
    const limite = propositionAChaiseVide();
    limite.placement[1].sieges[1][1] = 2 ** 31 - 1;
    assert.equal(premiereFaute(limite, PROPOSITION), null);
    const occupant = regleDe(regleDe(PROPOSITION, 'placement').element, 'sieges').element.element;
    const identifiant = regleDe(PROPOSITION, 'participants').element;
    assert.deepEqual([occupant.min, occupant.max, occupant.nul], [identifiant.min, identifiant.max, true]);
  });

  test("l'analyse lit un fichier dont une proposition porte une chaise vide, et sa relecture rend la liste telle qu'écrite", () => {
    const documentLu = documentValide();
    documentLu.charge.propositions = [propositionAChaiseVide()];
    const { charge } = analyser(JSON.stringify(documentLu));
    assert.deepStrictEqual(charge.propositions[0].placement[1].sieges[1], [1, null, 5]);
    const relue = analyser(serialiser(charge, { revision: 13, produitVersion: VERSION.affichee })).charge;
    assert.deepStrictEqual(relue.propositions[0], propositionAChaiseVide());
  });
});

describe('la cible de la somme de redondance : un réglage facultatif (§ 8.9)', () => {
  const REGLAGES = (() => {
    const CHARGE = SCHEMA.champs.find(([nom]) => nom === 'charge')[1];
    return CHARGE.champs.find(([nom]) => nom === 'reglages')[1];
  })();
  const CHEMIN = 'charge.reglages.cibleRedondance';

  test('sans le champ, le fichier se lit, la charge ne le porte pas, et la cible vaut 1000', () => {
    assert.equal(CIBLE_REDONDANCE_PAR_DEFAUT, 1000);
    const { charge } = analyser(JSON.stringify(documentValide()));
    assert.equal(Object.hasOwn(charge.reglages, 'cibleRedondance'), false);
    assert.equal(cibleRedondance(charge), 1000);
    assert.equal(premiereFaute(charge.reglages, REGLAGES), null);
    const neuve = creerCharge({ id: 'evt-neuf', nom: 'Atelier', siegesParDefaut: 8, tours: 3 });
    assert.equal(Object.hasOwn(neuve.reglages, 'cibleRedondance'), false);
    assert.equal(cibleRedondance(neuve), 1000);
  });

  test('un entier ≥ 0, sûr, se lit tel quel et fait la cible, 1000 écrit compris', () => {
    const valeurs = [0, 1, 1000, 1234, Number.MAX_SAFE_INTEGER];
    assert.ok(valeurs.length > 0);
    for (const valeur of valeurs) {
      const { charge } = analyser(abime((d) => { d.charge.reglages.cibleRedondance = valeur; }));
      assert.equal(charge.reglages.cibleRedondance, valeur);
      assert.equal(cibleRedondance(charge), valeur);
    }
  });

  test('une valeur négative, non entière, hors des entiers sûrs ou d\'une autre sorte est refusée FORME, par son chemin', () => {
    const cas = [
      ['négative', -1],
      ['non entière', 2.5],
      ['au-delà des entiers sûrs', 2 ** 53],
      ['en texte', '1000'],
      ['booléenne', true],
      ['nulle', null],
      ['une liste', [1000]],
    ];
    assert.deepEqual(ecartsDeRefus(cas.map(([libelle, valeur]) => [
      libelle,
      abime((d) => { d.charge.reglages.cibleRedondance = valeur; }),
      'FORME',
      CHEMIN,
    ])), []);
  });

  test("absente, la charge s'écrit sans le champ ; posée, il s'écrit après la génération, et la relecture rend la même charge", () => {
    const { charge } = analyser(JSON.stringify(documentValide()));
    const sans = serialiser(charge, { revision: 12, produitVersion: VERSION.affichee });
    assert.equal(sans.includes('cibleRedondance'), false);
    const posee = structuredClone(charge);
    posee.reglages = { cibleRedondance: 1200, ...posee.reglages };
    const avec = serialiser(posee, { revision: 12, produitVersion: VERSION.affichee });
    assert.ok(avec.includes('"generation":{"nombre":3,"arret":50000,"historique":500},"cibleRedondance":1200}'), avec);
    assert.deepEqual(analyser(avec).charge, analyser(serialiser(analyser(avec).charge, { revision: 12, produitVersion: VERSION.affichee })).charge);
    assert.equal(cibleRedondance(analyser(avec).charge), 1200);
  });

  test("un fichier d'un format plus récent garde la cible qu'il porte, réduite aux clés connues", () => {
    const texte = abime((d) => {
      d.entete.format = FORMAT + 1;
      d.charge.reglages.cibleRedondance = 750;
      d.charge.reglages.autreReglage = true;
    });
    const lecture = analyser(texte);
    assert.equal(lecture.formatPlusRecent, true);
    assert.equal(cibleRedondance(lecture.charge), 750);
    assert.equal(Object.hasOwn(lecture.charge.reglages, 'autreReglage'), false);
  });
});

describe('le placement daté : un champ facultatif du retenu et des propositions (§ 8.9, Q2)', () => {
  const regleDe = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
  const CHARGE = regleDe(SCHEMA, 'charge');
  const RETENU = regleDe(CHARGE, 'retenu');
  const PROPOSITION = regleDe(CHARGE, 'propositions').element;
  const H = '2031-05-17T20:15:00-04:00';
  const H2 = '2031-05-17T21:40:00+02:00';
  const ENTETE = { revision: 12, produitVersion: VERSION.affichee };

  // Le document valide, son retenu posé ; modifier passe sur lui.
  function avecRetenu(modifier = () => {}) {
    const copie = documentValide();
    copie.entete.comptes.retenu = 1;
    copie.charge.evenement.etat = 'retenu';
    copie.charge.retenu = retenuValide();
    modifier(copie);
    return copie;
  }

  test('posé sur le retenu et sur une proposition, il se lit, s’écrit après placement, en dernière clé, et se relit pareil', () => {
    const lu = analyser(JSON.stringify(avecRetenu((d) => {
      d.charge.retenu.horodatage = H;
      d.charge.propositions[0].horodatage = H2;
    })));
    assert.equal(lu.charge.retenu.horodatage, H);
    assert.equal(lu.charge.propositions[0].horodatage, H2);
    assert.equal(premiereFaute(lu.charge.retenu, RETENU), null);
    assert.equal(premiereFaute(lu.charge.propositions[0], PROPOSITION), null);
    assert.deepEqual(RETENU.champs.at(-1)[0], 'horodatage');
    assert.deepEqual(PROPOSITION.champs.at(-1)[0], 'horodatage');
    const texte = serialiser(lu.charge, ENTETE);
    assert.equal(texte.split('"horodatage"').length, 3, texte);
    assert.ok(texte.includes(`\n    ],"horodatage":${JSON.stringify(H)}}\n`), texte);
    assert.ok(texte.includes(`\n      ],"horodatage":${JSON.stringify(H2)}}\n`), texte);
    assert.equal(serialiser(analyser(texte).charge, ENTETE), texte);
  });

  test('absent, la charge ne le porte pas et s’écrit sans lui ; posé puis retiré, le texte revient octet pour octet', () => {
    const sans = analyser(JSON.stringify(avecRetenu())).charge;
    assert.equal(Object.hasOwn(sans.retenu, 'horodatage'), false);
    assert.equal(Object.hasOwn(sans.propositions[0], 'horodatage'), false);
    const texteSans = serialiser(sans, ENTETE);
    assert.equal(texteSans.includes('horodatage'), false);
    const date = structuredClone(sans);
    date.retenu.horodatage = H;
    date.propositions[0].horodatage = H2;
    assert.notEqual(serialiser(date, ENTETE), texteSans);
    delete date.retenu.horodatage;
    delete date.propositions[0].horodatage;
    assert.equal(serialiser(date, ENTETE), texteSans);
  });

  test('chaque démonstration livrée se relit et se réécrit octet pour octet, sans horodatage', () => {
    const livrees = ['grande', 'grande-sans-exception', 'petite', 'petite-conflit'];
    assert.equal(livrees.length, 4);
    for (const cle of livrees) {
      const surDisque = readFileSync(new URL(`../demo/livrees/${cle}.gtt.json`, import.meta.url), 'utf8');
      assert.equal(texteLivre(cle), surDisque, cle);
      const { entete, charge } = analyser(surDisque);
      assert.equal(serialiser(charge, entete), surDisque, cle);
      assert.equal(surDisque.includes('horodatage'), false, cle);
    }
  });

  test('une valeur d’une autre forme est une faute FORME de son placement, nommée par son chemin', () => {
    const fautives = ['2026-10-09 19:00', 12, null, '', '2031-05-17T20:15:00', '2031-05-17T20:15:00Z', ' 2031-05-17T20:15:00-04:00', [H]];
    assert.equal(fautives.length, 8);
    for (const valeur of fautives) {
      const retenu = { ...retenuValide(), horodatage: valeur };
      assert.equal(premiereFaute(retenu, RETENU), 'horodatage', JSON.stringify(valeur));
      const proposition = { ...documentValide().charge.propositions[0], horodatage: valeur };
      assert.equal(premiereFaute(proposition, PROPOSITION, 'charge.propositions[0]'), 'charge.propositions[0].horodatage', JSON.stringify(valeur));
      assert.deepEqual(fautesDePlacement(proposition), [{ code: 'FORME', chemin: 'horodatage' }], JSON.stringify(valeur));
      assert.deepEqual(fautesDePlacement(retenu), [{ code: 'FORME', chemin: 'horodatage' }], JSON.stringify(valeur));
    }
  });

  test('un fichier d’un format plus récent garde l’horodatage qu’il porte, réduit aux clés connues', () => {
    const lecture = analyser(JSON.stringify(avecRetenu((d) => {
      d.entete.format = FORMAT + 1;
      d.charge.retenu.horodatage = H;
      d.charge.retenu.autreCle = 1;
    })));
    assert.equal(lecture.formatPlusRecent, true);
    assert.equal(lecture.charge.retenu.horodatage, H);
    assert.equal(Object.hasOwn(lecture.charge.retenu, 'autreCle'), false);
  });
});

// --- Les champs facultatifs du format 2 (§ 4.5, § 8.9, A16) ---------------

// Le document valide portant chaque champ facultatif du format 2 hors de son
// défaut : des étiquettes à deux personnes, deux objectifs à la table 1 — la
// soirée, qui suit le défaut, et le tour 2, de règle propre —, la règle par
// défaut « et », les objectifs non respectés, le mode « l'équité d'abord »,
// la rencontre des animateurs cochée. Une copie neuve à chaque appel.
function documentComplet() {
  const d = documentValide();
  d.charge.reglages.regleObjectifs = 'et';
  d.charge.reglages.respecterObjectifs = false;
  d.charge.reglages.modeObjectifs = 'minimum';
  d.charge.reglages.rencontrerAnimateurs = true;
  d.charge.participants[0].etiquettes = ['Montréal', 'finance'];
  d.charge.participants[3].etiquettes = ['bénévole'];
  d.charge.tables[0].objectifs = [
    { portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] },
    { portee: 'tour', tour: 2, regle: 'ou', etiquettes: ['Montréal', 'ressources humaines'] },
  ];
  return d;
}

// Texte du document complet, une fois modifier passé sur lui.
function abimeComplet(modifier) {
  const copie = documentComplet();
  modifier(copie);
  return JSON.stringify(copie);
}

// Chemins, rangs effacés, des valeurs nouvelles du format 2 que le contrat
// admet nulles.
const ADMETTENT_NULL_FORMAT_2 = new Set([...ADMETTENT_NULL, 'charge.tables[].objectifs[].tour', 'charge.tables[].objectifs[].regle']);

// Vrai pour les étapes d'une valeur que le format 2 ajoute : sous les
// étiquettes d'une personne, les objectifs d'une table, ou l'un des quatre
// réglages nouveaux.
const REGLAGES_FORMAT_2 = ['regleObjectifs', 'respecterObjectifs', 'modeObjectifs', 'rencontrerAnimateurs'];
const estDuFormat2 = (etapes) =>
  etapes.includes('etiquettes') ||
  etapes.includes('objectifs') ||
  (etapes[1] === 'reglages' && REGLAGES_FORMAT_2.includes(etapes[2]));

const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const CHARGE_SCHEMA = regleDuChamp(SCHEMA, 'charge');

describe('les champs facultatifs du format 2 : forme et place (§ 8.9, A16)', () => {
  test('chacun est facultatif, écrit après les clés du format 1 de son objet, les réglages dans l’ordre de A16', () => {
    const REGLAGES = regleDuChamp(CHARGE_SCHEMA, 'reglages');
    const PARTICIPANT = regleDuChamp(CHARGE_SCHEMA, 'participants').element;
    const TABLE = regleDuChamp(CHARGE_SCHEMA, 'tables').element;
    assert.deepEqual(
      REGLAGES.champs.slice(-5).map(([cle, regle]) => [cle, regle.optionnel]),
      [
        ['cibleRedondance', true],
        ['regleObjectifs', true],
        ['respecterObjectifs', true],
        ['modeObjectifs', true],
        ['rencontrerAnimateurs', true],
      ],
    );
    assert.deepEqual(PARTICIPANT.champs.slice(-2).map(([cle, regle]) => [cle, regle.optionnel]), [['exclu', false], ['etiquettes', true]]);
    assert.deepEqual(TABLE.champs.slice(-2).map(([cle, regle]) => [cle, regle.optionnel]), [['position', false], ['objectifs', true]]);
  });

  test('le document complet se lit tel quel ; il s’écrit dans l’ordre du schéma, listes rangées, et se relit à l’identique', () => {
    const { entete, charge } = documentComplet();
    assert.deepEqual(analyser(JSON.stringify(documentComplet())), {
      entete,
      charge,
      formatPlusRecent: false,
      manquants: { propositions: 0, retenu: false },
    });
    const texte = serialiser(charge, { revision: 12, produitVersion: VERSION.affichee });
    const attendus = [
      '"generation":{"nombre":3,"arret":50000,"historique":500},"regleObjectifs":"et","respecterObjectifs":false,"modeObjectifs":"minimum","rencontrerAnimateurs":true}',
      '"notes":null,"exclu":false,"etiquettes":["Montréal","finance"]}',
      '"exclu":false,"etiquettes":["bénévole"]}',
      '"position":{"x":0,"y":0},"objectifs":[{"portee":"tous","tour":null,"regle":null,"etiquettes":["finance"]},{"portee":"tour","tour":2,"regle":"ou","etiquettes":["Montréal","ressources humaines"]}]}',
    ];
    for (const attendu of attendus) assert.ok(texte.includes(attendu), `${attendu}\n${texte}`);
    const relue = analyser(texte);
    assert.deepEqual(relue.charge, charge);
    assert.equal(serialiser(relue.charge, relue.entete), texte);
    const avecCible = structuredClone(charge);
    avecCible.reglages.cibleRedondance = 900;
    assert.ok(
      serialiser(avecCible, relue.entete).includes('"historique":500},"cibleRedondance":900,"regleObjectifs":"et",'),
      'la cible avant la règle',
    );
  });

  test('des étiquettes hors de l’ordre des unités de code et des objectifs hors de l’ordre soirée puis tours se lisent, et s’écrivent rangés', () => {
    const lu = analyser(abimeComplet((d) => {
      d.charge.participants[0].etiquettes = ['finance', 'Montréal', 'Été', 'été'];
      d.charge.tables[0].objectifs.reverse();
      d.charge.tables[0].objectifs[0].etiquettes = ['ressources humaines', 'Montréal'];
    }));
    const texte = serialiser(lu.charge, { revision: 12, produitVersion: VERSION.affichee });
    const relue = analyser(texte).charge;
    assert.deepEqual(relue.participants[0].etiquettes, ['Montréal', 'finance', 'Été', 'été']);
    assert.deepEqual(relue.tables[0].objectifs, documentComplet().charge.tables[0].objectifs);
  });

  test('variantes admises : deux orthographes d’une même clé, une étiquette égale à une appartenance, 20 étiquettes de 40 points de code, la règle propre « et », un objectif à chaque tour sans soirée', () => {
    const vingt = Array.from({ length: 20 }, (_, rang) => `${String.fromCharCode(65 + rang)}${'x'.repeat(39)}`);
    const variantes = [
      ['Finance et finance', abimeComplet((d) => { d.charge.participants[0].etiquettes = ['Finance', 'finance']; })],
      ['une étiquette égale à une appartenance', abimeComplet((d) => { d.charge.participants[0].etiquettes = ['Chorale du Vallon']; })],
      ['20 étiquettes de 40 points de code', abimeComplet((d) => { d.charge.participants[3].etiquettes = vingt; })],
      ['un objectif de 20 étiquettes', abimeComplet((d) => { d.charge.tables[0].objectifs[0].etiquettes = vingt; })],
      ['règle propre « et »', abimeComplet((d) => { d.charge.tables[0].objectifs[1].regle = 'et'; })],
      ['un objectif à chaque tour, aucun de soirée', abimeComplet((d) => {
        d.charge.tables[1].objectifs = [
          { portee: 'tour', tour: 1, regle: null, etiquettes: ['finance'] },
          { portee: 'tour', tour: 2, regle: null, etiquettes: ['bénévole'] },
        ];
      })],
      ['la règle par défaut seule, sans objectif', abime((d) => { d.charge.reglages.regleObjectifs = 'et'; })],
      ['le mode « chacun » sans objectif', abime((d) => { d.charge.reglages.modeObjectifs = 'chacun'; })],
    ];
    const echecs = variantes.flatMap(([libelle, texte]) => {
      try {
        analyser(texte);
        return [];
      } catch (erreur) {
        return [`${libelle} : ${erreur.message}`];
      }
    });
    assert.deepEqual(echecs, []);
  });

  test('un champ écrit à son défaut est une faute de forme, nommée par son chemin : « ou », vrai, « places », faux', () => {
    assert.deepEqual(ecartsDeRefus([
      ['règle par défaut « ou » écrite', abime((d) => { d.charge.reglages.regleObjectifs = 'ou'; }), 'FORME', 'charge.reglages.regleObjectifs'],
      ['objectifs respectés écrits', abime((d) => { d.charge.reglages.respecterObjectifs = true; }), 'FORME', 'charge.reglages.respecterObjectifs'],
      ['mode « places » écrit', abime((d) => { d.charge.reglages.modeObjectifs = 'places'; }), 'FORME', 'charge.reglages.modeObjectifs'],
      ['animateurs décochés écrits', abime((d) => { d.charge.reglages.rencontrerAnimateurs = false; }), 'FORME', 'charge.reglages.rencontrerAnimateurs'],
      ['étiquettes vides', abime((d) => { d.charge.participants[1].etiquettes = []; }), 'FORME', 'charge.participants[1].etiquettes'],
      ['objectifs vides', abime((d) => { d.charge.tables[1].objectifs = []; }), 'FORME', 'charge.tables[1].objectifs'],
    ]), []);
  });

  test('une valeur hors de son domaine est une faute de forme : un mode inconnu, une règle inconnue, une étiquette mal formée, un doublon exact, 21 étiquettes', () => {
    const vingtEtUne = Array.from({ length: 21 }, (_, rang) => `groupe ${rang + 1}`);
    const cas = [
      ['mode inconnu', (d) => { d.charge.reglages.modeObjectifs = 'aleatoire'; }, 'charge.reglages.modeObjectifs'],
      ['mode en capitales', (d) => { d.charge.reglages.modeObjectifs = 'CHACUN'; }, 'charge.reglages.modeObjectifs'],
      ['règle par défaut en capitales', (d) => { d.charge.reglages.regleObjectifs = 'ET'; }, 'charge.reglages.regleObjectifs'],
      ['objectifs respectés en texte', (d) => { d.charge.reglages.respecterObjectifs = 'false'; }, 'charge.reglages.respecterObjectifs'],
      ['animateurs en texte', (d) => { d.charge.reglages.rencontrerAnimateurs = 'true'; }, 'charge.reglages.rencontrerAnimateurs'],
      ['une étiquette vide', (d) => { d.charge.participants[0].etiquettes = ['']; }, 'charge.participants[0].etiquettes[0]'],
      ['une étiquette à blanc en bord', (d) => { d.charge.participants[0].etiquettes = ['finance', ' RH']; }, 'charge.participants[0].etiquettes[1]'],
      ['deux espaces', (d) => { d.charge.participants[0].etiquettes = ['ressources  humaines']; }, 'charge.participants[0].etiquettes[0]'],
      ['une tabulation', (d) => { d.charge.participants[0].etiquettes = ['ressources\u{0009}humaines']; }, 'charge.participants[0].etiquettes[0]'],
      ['une fin de ligne', (d) => { d.charge.participants[0].etiquettes = ['a\u{000A}b']; }, 'charge.participants[0].etiquettes[0]'],
      ['une barre', (d) => { d.charge.participants[0].etiquettes = ['a|b']; }, 'charge.participants[0].etiquettes[0]'],
      ['une virgule', (d) => { d.charge.participants[0].etiquettes = ['a,b']; }, 'charge.participants[0].etiquettes[0]'],
      ['un point-virgule', (d) => { d.charge.participants[0].etiquettes = ['a;b']; }, 'charge.participants[0].etiquettes[0]'],
      ['« é » décomposé', (d) => { d.charge.participants[0].etiquettes = ['Montre\u{0301}al']; }, 'charge.participants[0].etiquettes[0]'],
      ['41 points de code', (d) => { d.charge.participants[0].etiquettes = ['a'.repeat(41)]; }, 'charge.participants[0].etiquettes[0]'],
      ['une étiquette numérique', (d) => { d.charge.participants[0].etiquettes = [42]; }, 'charge.participants[0].etiquettes[0]'],
      ['un doublon exact', (d) => { d.charge.participants[0].etiquettes = ['finance', 'finance']; }, 'charge.participants[0].etiquettes'],
      ['21 étiquettes', (d) => { d.charge.participants[0].etiquettes = vingtEtUne; }, 'charge.participants[0].etiquettes'],
      ['une portée inconnue', (d) => { d.charge.tables[0].objectifs[0].portee = 'soiree'; }, 'charge.tables[0].objectifs[0].portee'],
      ['une règle propre inconnue', (d) => { d.charge.tables[0].objectifs[1].regle = 'peut-etre'; }, 'charge.tables[0].objectifs[1].regle'],
      ['un tour 0', (d) => { d.charge.tables[0].objectifs[1].tour = 0; }, 'charge.tables[0].objectifs[1].tour'],
      ['un tour non entier', (d) => { d.charge.tables[0].objectifs[1].tour = 1.5; }, 'charge.tables[0].objectifs[1].tour'],
      ['un objectif sans étiquette', (d) => { d.charge.tables[0].objectifs[0].etiquettes = []; }, 'charge.tables[0].objectifs[0].etiquettes'],
      ['un objectif de 21 étiquettes', (d) => { d.charge.tables[0].objectifs[0].etiquettes = vingtEtUne; }, 'charge.tables[0].objectifs[0].etiquettes'],
      ['un objectif à doublon exact', (d) => { d.charge.tables[0].objectifs[0].etiquettes = ['RH', 'RH']; }, 'charge.tables[0].objectifs[0].etiquettes'],
      ['un objectif à étiquette mal formée', (d) => { d.charge.tables[0].objectifs[0].etiquettes = ['finance', 'x\u{0007}']; }, 'charge.tables[0].objectifs[0].etiquettes[1]'],
      ['un objectif sans sa règle', (d) => { delete d.charge.tables[0].objectifs[0].regle; }, 'charge.tables[0].objectifs[0].regle'],
    ];
    assert.deepEqual(ecartsDeRefus(cas.map(([libelle, modifier, chemin]) => [libelle, abimeComplet(modifier), 'FORME', chemin])), []);
  });

  test('la portée et le tour d’un objectif se répondent, le tour reste dans la soirée, et une table porte au plus un objectif par portée et tour', () => {
    assert.deepEqual(ecartsDeRefus([
      ['portée « tous » avec un tour', abimeComplet((d) => { d.charge.tables[0].objectifs[0].tour = 1; }), 'FORME', 'charge.tables[0].objectifs[0].tour'],
      ['portée « tour » sans tour', abimeComplet((d) => { d.charge.tables[0].objectifs[1].tour = null; }), 'FORME', 'charge.tables[0].objectifs[1].tour'],
      ['tour au-delà du nombre de tours', abimeComplet((d) => { d.charge.tables[0].objectifs[1].tour = 3; }), 'FORME', 'charge.tables[0].objectifs[1].tour'],
      ['deux objectifs de soirée, le second fautif', abimeComplet((d) => {
        d.charge.tables[0].objectifs.splice(1, 0, { portee: 'tous', tour: null, regle: 'et', etiquettes: ['RH'] });
      }), 'FORME', 'charge.tables[0].objectifs[1]'],
      ['deux objectifs du tour 2', abimeComplet((d) => {
        d.charge.tables[0].objectifs.push({ portee: 'tour', tour: 2, regle: null, etiquettes: ['RH'] });
      }), 'FORME', 'charge.tables[0].objectifs[2]'],
      ['la seconde table fautive après la première admise', abimeComplet((d) => {
        d.charge.tables[1].objectifs = [{ portee: 'tour', tour: 5, regle: null, etiquettes: ['RH'] }];
      }), 'FORME', 'charge.tables[1].objectifs[0].tour'],
      ['la forme avant la portée', abimeComplet((d) => {
        d.charge.tables[0].objectifs[0].tour = 1;
        d.charge.tables[1].objectifs = [{ portee: 'tour', tour: 2, regle: null, etiquettes: [] }];
      }), 'FORME', 'charge.tables[1].objectifs[0].etiquettes'],
    ]), []);
  });

  test('sur chaque valeur nouvelle : une clé inconnue, une valeur d’une autre sorte, null où le contrat ne l’admet pas, sont nommés par leur chemin', () => {
    const etapes = etapesDe(documentComplet()).filter(estDuFormat2);
    assert.ok(etapes.length >= 20, `${etapes.length} valeurs seulement`);
    const objets = etapes.filter((e) => {
      const valeur = valeurEn(documentComplet(), e);
      return typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
    });
    assert.equal(objets.length, 2);
    const cas = [
      ...objets.map((e) => [
        `inconnue sous ${cheminDe(e)}`,
        abimeComplet((d) => { valeurEn(d, e).inconnue = 1; }),
        'FORME',
        cheminDe([...e, 'inconnue']),
      ]),
      ...etapes.map((e) => [
        `${cheminDe(e)} d'une autre sorte`,
        abimeComplet((d) => {
          const porteur = valeurEn(d, e.slice(0, -1));
          porteur[e.at(-1)] = Array.isArray(porteur[e.at(-1)]) ? {} : [];
        }),
        'FORME',
        cheminDe(e),
      ]),
      ...etapes.filter((e) => !ADMETTENT_NULL_FORMAT_2.has(sansRangs(e))).map((e) => [
        `${cheminDe(e)} nul`,
        abimeComplet((d) => { valeurEn(d, e.slice(0, -1))[e.at(-1)] = null; }),
        'FORME',
        cheminDe(e),
      ]),
    ];
    assert.deepEqual(ecartsDeRefus(cas), []);
  });
});

describe('un fichier du format 1 se lit comme un fichier du format 2 qui ne porte aucun champ nouveau (§ 8.8, A15)', () => {
  test('il se lit, formatPlusRecent faux, sa charge telle qu’écrite ; réécrit, seul l’en-tête change, au format courant', () => {
    const formatUn = documentValide();
    formatUn.entete.format = 1;
    const lu = analyser(JSON.stringify(formatUn));
    assert.equal(lu.formatPlusRecent, false);
    assert.equal(lu.entete.format, 1);
    assert.deepEqual(lu.charge, documentValide().charge);
    const reecrit = serialiser(lu.charge, lu.entete);
    assert.equal(analyser(reecrit).entete.format, FORMAT);
    assert.equal(serialiserCharge(analyser(reecrit).charge), serialiserCharge(lu.charge));
    assert.equal(regleObjectifs(lu.charge), 'ou');
    assert.equal(modeObjectifs(lu.charge), 'places');
  });

  test('ses refus gardent leur raison, sans format dans les détails : il n’est pas plus récent', () => {
    assert.deepEqual(ecartsDeRefus([
      ['nom vide', abime((d) => { d.entete.format = 1; d.charge.participants[0].nom = ''; }), 'FORME', 'charge.participants[0].nom'],
      ['comptes faux', abime((d) => { d.entete.format = 1; d.entete.comptes.tables = 1; }), 'COMPTES', 'entete.comptes.tables'],
      ['mode « places » écrit', abime((d) => { d.entete.format = 1; d.charge.reglages.modeObjectifs = 'places'; }), 'FORME', 'charge.reglages.modeObjectifs'],
    ]), []);
  });
});

describe('un fichier plus récent porte les champs du format 2 (§ 8.8)', () => {
  test('ils se lisent, réduits aux clés connues ; une valeur que le format courant refuse lève FORMAT_PLUS_RECENT', () => {
    const lu = analyser(abimeComplet((d) => {
      d.entete.format = FORMAT + 1;
      d.charge.tables[0].objectifs[0].poids = 3;
      d.charge.participants[0].couleurEtiquettes = 'ocre';
    }));
    assert.equal(lu.formatPlusRecent, true);
    assert.deepEqual(lu.charge, documentComplet().charge);
    assert.deepEqual(ecartsDeRefus([
      ['un mode à venir', abimeComplet((d) => {
        d.entete.format = FORMAT + 1;
        d.charge.reglages.modeObjectifs = 'pondere';
      }), 'FORMAT_PLUS_RECENT', 'charge.reglages.modeObjectifs', { format: FORMAT + 1 }],
    ]), []);
  });
});

describe('les lecteurs des réglages facultatifs (§ 8.9)', () => {
  test('absents, ils rendent leur défaut : « ou », coché, décoché, « places »', () => {
    const { charge } = documentValide();
    assert.equal(regleObjectifs(charge), 'ou');
    assert.equal(critereCoche(charge, 'respecterObjectifs'), true);
    assert.equal(critereCoche(charge, 'rencontrerAnimateurs'), false);
    assert.equal(modeObjectifs(charge), 'places');
    const neuve = creerCharge({ id: 'evt-neuf', nom: 'Atelier', siegesParDefaut: 8, tours: 3 });
    assert.deepEqual(
      [regleObjectifs(neuve), critereCoche(neuve, 'respecterObjectifs'), critereCoche(neuve, 'rencontrerAnimateurs'), modeObjectifs(neuve)],
      ['ou', true, false, 'places'],
    );
  });

  test('présents, ils rendent la valeur portée', () => {
    const { charge } = documentComplet();
    assert.equal(regleObjectifs(charge), 'et');
    assert.equal(critereCoche(charge, 'respecterObjectifs'), false);
    assert.equal(critereCoche(charge, 'rencontrerAnimateurs'), true);
    assert.equal(modeObjectifs(charge), 'minimum');
    charge.reglages.modeObjectifs = 'chacun';
    assert.equal(modeObjectifs(charge), 'chacun');
  });

  test('critereCoche lit aussi les quatre cases du format 1, et lève RangeError sur une clé qu’il ne connaît pas', () => {
    const { charge } = documentValide();
    assert.deepEqual(
      ['separerAppartenances', 'nouveauxVoisins', 'nouvelleTable', 'varierAppartenances'].map((cle) => critereCoche(charge, cle)),
      [true, false, true, false],
    );
    for (const cle of ['attribuerSieges', 'generation', 'cibleRedondance', 'modeObjectifs', 'inconnue', '__proto__', 'toString']) {
      assert.throws(() => critereCoche(charge, cle), RangeError, cle);
    }
  });
});

describe('configurationDepuisCharge : étiquettes, objectifs, mode et cases (contrat de données)', () => {
  test('sans champ nouveau, la configuration n’en porte aucun', () => {
    const configuration = configurationDepuisCharge(documentValide().charge);
    assert.deepEqual(Object.keys(configuration).sort(), ['contraintes', 'participants', 'reservations', 'tables', 'tours']);
    assert.deepEqual(Object.keys(configuration.contraintes).sort(), ['nouveauxVoisins', 'nouvelleTable', 'separerAppartenances', 'varierAppartenances']);
    assert.ok(configuration.participants.every((participant) => !Object.hasOwn(participant, 'etiquettes')));
  });

  test('chaque champ nouveau se transporte, la règle de chaque objectif résolue ; la table par identifiant, puis la soirée et les tours croissants', () => {
    const { charge } = documentComplet();
    charge.tables.reverse();
    charge.tables[0].objectifs = [{ portee: 'tour', tour: 1, regle: 'et', etiquettes: ['bénévole'] }];
    charge.tables[1].objectifs.reverse();
    const configuration = configurationDepuisCharge(charge);
    assert.deepEqual(configuration.participants.map(({ id, etiquettes }) => [id, etiquettes]), [
      [1, ['Montréal', 'finance']],
      [2, undefined],
      [3, undefined],
      [5, ['bénévole']],
    ]);
    assert.deepEqual(configuration.objectifs, [
      { table: 1, tour: null, regle: 'et', etiquettes: ['finance'] },
      { table: 1, tour: 2, regle: 'ou', etiquettes: ['Montréal', 'ressources humaines'] },
      { table: 3, tour: 1, regle: 'et', etiquettes: ['bénévole'] },
    ]);
    assert.equal(configuration.modeObjectifs, 'minimum');
    assert.deepEqual(configuration.contraintes, {
      separerAppartenances: true,
      nouveauxVoisins: false,
      nouvelleTable: true,
      varierAppartenances: false,
      respecterObjectifs: false,
      rencontrerAnimateurs: true,
    });
  });

  test('une règle qui suit le défaut prend « ou » tant que le défaut n’est pas réglé ; une règle propre ne change pas avec lui', () => {
    const { charge } = documentComplet();
    delete charge.reglages.regleObjectifs;
    charge.tables[0].objectifs[1].regle = 'et';
    assert.deepEqual(configurationDepuisCharge(charge).objectifs.map(({ regle }) => regle), ['ou', 'et']);
    charge.reglages.regleObjectifs = 'et';
    charge.tables[0].objectifs[1].regle = 'ou';
    assert.deepEqual(configurationDepuisCharge(charge).objectifs.map(({ regle }) => regle), ['et', 'ou']);
  });

  test('chaque champ reste absent à son défaut, un par un', () => {
    const cas = [
      ['mode', (c) => { delete c.reglages.modeObjectifs; }, (k) => !Object.hasOwn(k, 'modeObjectifs')],
      ['objectifs respectés', (c) => { delete c.reglages.respecterObjectifs; }, (k) => !Object.hasOwn(k.contraintes, 'respecterObjectifs')],
      ['animateurs décochés', (c) => { delete c.reglages.rencontrerAnimateurs; }, (k) => !Object.hasOwn(k.contraintes, 'rencontrerAnimateurs')],
      ['aucun objectif', (c) => { delete c.tables[0].objectifs; }, (k) => !Object.hasOwn(k, 'objectifs')],
      ['aucune étiquette', (c) => { for (const p of c.participants) delete p.etiquettes; }, (k) => k.participants.every((p) => !Object.hasOwn(p, 'etiquettes'))],
    ];
    for (const [libelle, retirer, absent] of cas) {
      const { charge } = documentComplet();
      retirer(charge);
      assert.ok(absent(configurationDepuisCharge(charge)), libelle);
    }
  });

  test('la configuration ne partage aucune liste avec la charge, qui reste intacte', () => {
    const charge = geler(documentComplet().charge);
    const configuration = configurationDepuisCharge(charge);
    configuration.participants[0].etiquettes.push('RH');
    configuration.objectifs[0].etiquettes.push('RH');
    assert.deepEqual(charge.participants[0].etiquettes, ['Montréal', 'finance']);
    assert.deepEqual(charge.tables[0].objectifs[0].etiquettes, ['finance']);
    assert.deepEqual(normaliser(configuration).ids, [1, 2, 5]);
  });
});
