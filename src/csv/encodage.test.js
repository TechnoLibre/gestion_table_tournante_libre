// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du décodage d'un fichier CSV (§ 10.1, § 14.10) : les cinq
// encodages que rend decoder, les quatre temps dans leur ordre, les quatre
// refus et leur remède — UTF-16 sans marque, UTF-16 invalide sous sa marque,
// UTF-8 invalide sous la marque UTF-8, caractère nul dans le texte décodé —,
// la frontière des quatre premiers kibioctets, la forme de l'entrée, y
// compris un tampon venu d'un autre contexte d'exécution. Les octets se
// construisent ici sans passer par un décodeur : UTF-8 par TextEncoder,
// UTF-16 et UTF-32 unité par unité, windows-1252 octet par octet.
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { describe, test } from '../../test/lanceur.js';
import { contientNul, decoder } from './encodage.js';
import { ErreurCsv } from './erreurs.js';

const BENOIT = 'Benoît';

const MARQUE_UTF8 = [0xef, 0xbb, 0xbf];

const enUtf8 = (texte) => new TextEncoder().encode(texte);

// Les octets de tete, puis ceux de octets.
const avec = (tete, octets) => Uint8Array.from([...tete, ...octets]);

// Octets UTF-16 de texte, une unité à la fois : ordre vaut 'le' (octet de
// poids faible d'abord) ou 'be' ; la marque d'ordre d'octets ouvre le fichier
// quand avecMarque est vrai.
function enUtf16(texte, ordre, avecMarque = true) {
  const octets = [];
  if (avecMarque) octets.push(...(ordre === 'be' ? [0xfe, 0xff] : [0xff, 0xfe]));
  for (let i = 0; i < texte.length; i += 1) {
    const unite = texte.charCodeAt(i);
    const poids = [unite >> 8, unite & 0xff];
    octets.push(...(ordre === 'be' ? poids : poids.reverse()));
  }
  return Uint8Array.from(octets);
}

// Octets UTF-32 de texte, un point de code à la fois, précédés de la marque
// d'ordre d'octets : FF FE 00 00 pour 'le', 00 00 FE FF pour 'be'.
function enUtf32(texte, ordre) {
  const octets = ordre === 'be' ? [0x00, 0x00, 0xfe, 0xff] : [0xff, 0xfe, 0x00, 0x00];
  for (const caractere of texte) {
    const point = caractere.codePointAt(0);
    const poids = [point >>> 24, (point >> 16) & 0xff, (point >> 8) & 0xff, point & 0xff];
    octets.push(...(ordre === 'be' ? poids : poids.reverse()));
  }
  return Uint8Array.from(octets);
}

// Octets windows-1252 de texte : un caractère Latin-1 garde son code, les deux
// signes de 0x80 à 0x9F que les épreuves emploient ont le leur ; tout autre
// caractère fait échouer l'épreuve plutôt que de s'écrire de travers.
const WINDOWS_1252_PARTICULIERS = new Map([
  ['€', 0x80],
  ['’', 0x92],
]);
const enWindows1252 = (texte) =>
  Uint8Array.from(texte, (caractere) => {
    const code = WINDOWS_1252_PARTICULIERS.get(caractere) ?? caractere.codePointAt(0);
    assert.ok(code < 0x100, `« ${caractere} » n'existe pas en windows-1252`);
    return code;
  });

// L'erreur que lève fonction ; l'épreuve échoue quand elle ne lève rien.
function erreurDe(fonction) {
  try {
    fonction();
  } catch (erreur) {
    return erreur;
  }
  return assert.fail("rien n'a été levé");
}

// L'erreur que lève decoder sur ces octets.
const refusDe = (octets) => erreurDe(() => decoder(octets));

// Vérifie que erreur est le refus de code donné, remède compris : tout refus
// d'encodage renvoie au même remède.
function assertRefus(erreur, code) {
  assert.ok(erreur instanceof ErreurCsv);
  assert.equal(erreur.code, code);
  assert.deepEqual(erreur.details, { remede: 'ENREGISTRER_EN_UTF8' });
}

describe('decoder : les cinq encodages (§ 10.1)', () => {
  const CAS = [
    ['UTF-8 avec marque', avec(MARQUE_UTF8, enUtf8(BENOIT)), 'utf-8-bom'],
    ['UTF-8 sans marque', enUtf8(BENOIT), 'utf-8'],
    ['UTF-16 LE avec marque', enUtf16(BENOIT, 'le'), 'utf-16le'],
    ['UTF-16 BE avec marque', enUtf16(BENOIT, 'be'), 'utf-16be'],
    ['windows-1252', enWindows1252(BENOIT), 'windows-1252'],
  ];

  for (const [libelle, octets, encodage] of CAS) {
    test(`« Benoît » en ${libelle} : le texte, sans marque, et l'encodage retenu`, () => {
      assert.deepEqual(decoder(octets), { texte: BENOIT, encodage });
    });
  }

  test('windows-1252 : les octets 0x80 à 0x9F sont des signes, non des caractères de commande', () => {
    const texte = 'l’équipe à 5 €';
    assert.deepEqual(decoder(enWindows1252(texte)), { texte, encodage: 'windows-1252' });
  });

  test("UTF-8 : un caractère hors du plan de base et les accents d'un texte plus long", () => {
    const texte = 'nom;prenom\r\nÉlodie Témoin;Noël 𝄞\r\n';
    assert.deepEqual(decoder(enUtf8(texte)), { texte, encodage: 'utf-8' });
  });

  test("UTF-16 : une paire de substitution d'un caractère hors du plan de base, en LE comme en BE", () => {
    const texte = 'Odile 𝄞';
    assert.deepEqual(decoder(enUtf16(texte, 'le')), { texte, encodage: 'utf-16le' });
    assert.deepEqual(decoder(enUtf16(texte, 'be')), { texte, encodage: 'utf-16be' });
  });

  test('un fichier vide, ou réduit à sa marque, donne un texte vide', () => {
    assert.deepEqual(decoder(new Uint8Array(0)), { texte: '', encodage: 'utf-8' });
    assert.deepEqual(decoder(Uint8Array.from(MARQUE_UTF8)), { texte: '', encodage: 'utf-8-bom' });
    assert.deepEqual(decoder(Uint8Array.from([0xff, 0xfe])), { texte: '', encodage: 'utf-16le' });
    assert.deepEqual(decoder(Uint8Array.from([0xfe, 0xff])), { texte: '', encodage: 'utf-16be' });
  });

  test("une marque incomplète n'en est pas une : ses octets restent du texte", () => {
    assert.deepEqual(decoder(enWindows1252('ïle Fictive')), { texte: 'ïle Fictive', encodage: 'windows-1252' });
    assert.deepEqual(decoder(Uint8Array.from([0xef, 0xbb])), { texte: 'ï»', encodage: 'windows-1252' });
    assert.deepEqual(decoder(Uint8Array.from([0xef, 0xbb, 0x78])), { texte: 'ï»x', encodage: 'windows-1252' });
    assert.deepEqual(decoder(Uint8Array.from([0xff, 0x61])), { texte: 'ÿa', encodage: 'windows-1252' });
    assert.deepEqual(decoder(Uint8Array.from([0xfe, 0x61])), { texte: 'þa', encodage: 'windows-1252' });
  });

  test("un ArrayBuffer se décode comme les octets qu'il porte", () => {
    const octets = avec(MARQUE_UTF8, enUtf8(BENOIT));
    assert.deepEqual(decoder(octets.buffer), { texte: BENOIT, encodage: 'utf-8-bom' });
  });

  test("une vue sur une partie d'un tampon plus grand se décode seule, sans les octets voisins", () => {
    const tampon = avec([0x78, 0x78], avec(MARQUE_UTF8, avec(enUtf8(BENOIT), [0x79, 0x79])));
    const vue = new Uint8Array(tampon.buffer, 2, MARQUE_UTF8.length + enUtf8(BENOIT).length);
    assert.deepEqual(decoder(vue), { texte: BENOIT, encodage: 'utf-8-bom' });
  });
});

describe("decoder : la forme de l'entrée", () => {
  // Les octets de « Benoît » en UTF-8 avec marque, écrits dans le contexte
  // d'exécution neuf, qui a ses propres ArrayBuffer et Uint8Array.
  const OCTETS_ECRITS = JSON.stringify([...avec(MARQUE_UTF8, enUtf8(BENOIT))]);

  test("un ArrayBuffer d'un autre contexte d'exécution se décode : instanceof ne le reconnaît pas", () => {
    const tampon = runInNewContext(`new Uint8Array(${OCTETS_ECRITS}).buffer`);
    assert.ok(!(tampon instanceof ArrayBuffer));
    assert.deepEqual(decoder(tampon), { texte: BENOIT, encodage: 'utf-8-bom' });
  });

  test("un Uint8Array d'un autre contexte d'exécution se décode", () => {
    const vue = runInNewContext(`new Uint8Array(${OCTETS_ECRITS})`);
    assert.ok(!(vue instanceof Uint8Array));
    assert.deepEqual(decoder(vue), { texte: BENOIT, encodage: 'utf-8-bom' });
  });

  test('un Buffer de Node, sous-classe de Uint8Array, se décode', () => {
    const buffer = Buffer.from(avec(MARQUE_UTF8, enUtf8(BENOIT)));
    assert.deepEqual(decoder(buffer), { texte: BENOIT, encodage: 'utf-8-bom' });
  });

  test("une entrée qui n'est pas des octets est refusée par un TypeError, non lue comme un fichier vide", () => {
    // Une promesse (arrayBuffer() non attendu), un Blob (le fichier même), une
    // chaîne, rien : new Uint8Array en ferait des octets en nombre nul.
    const entrees = [
      'abc',
      undefined,
      null,
      Promise.resolve(new Uint8Array(0)),
      new Blob(['abc']),
      [0xef, 0xbb, 0xbf],
    ];
    for (const entree of entrees) {
      assert.throws(() => decoder(entree), TypeError);
    }
  });
});

describe('decoder : un UTF-16 sans marque est refusé, avec son remède (§ 10.1)', () => {
  test('« Benoît » en UTF-16 LE sans marque : refus, remède nommé', () => {
    assertRefus(refusDe(enUtf16(BENOIT, 'le', false)), 'UTF16_SANS_MARQUE');
  });

  test('« Benoît » en UTF-16 BE sans marque : refus, remède nommé', () => {
    assertRefus(refusDe(enUtf16(BENOIT, 'be', false)), 'UTF16_SANS_MARQUE');
  });

  test("un contenu sans accent est de l'UTF-8 valide en UTF-16 : refusé de même, non lu en texte entrelardé de caractères nuls", () => {
    // Chaque octet nul s'y décode comme le caractère nul : l'ordre à trois
    // temps rendrait « n\0o\0m\0… » sans rien refuser.
    const octets = enUtf16('nom;prenom\r\nBenoit Exemple;Odile', 'le', false);
    assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(octets));
    assertRefus(refusDe(octets), 'UTF16_SANS_MARQUE');
  });

  test("avec un accent, le texte n'est plus de l'UTF-8 valide : l'ordre à trois temps le rendrait en windows-1252, nuls compris — refusé", () => {
    const octets = enUtf16(BENOIT, 'le', false);
    assert.throws(() => new TextDecoder('utf-8', { fatal: true }).decode(octets), TypeError);
    assertRefus(refusDe(octets), 'UTF16_SANS_MARQUE');
  });

  test("l'octet nul n'est cherché sans marque que dans les 4 096 premiers octets ; au-delà, c'est le caractère nul qui est refusé", () => {
    const octets = new Uint8Array(4097).fill(0x61);
    octets[4095] = 0;
    assertRefus(refusDe(octets), 'UTF16_SANS_MARQUE');
    octets[4095] = 0x61;
    octets[4096] = 0;
    assertRefus(refusDe(octets), 'CARACTERE_NUL');
  });

  test('la sonde commence au premier octet : « A » en UTF-16 BE sans marque, un seul octet nul', () => {
    assertRefus(refusDe(Uint8Array.of(0x00, 0x41)), 'UTF16_SANS_MARQUE');
  });

  test('un UTF-16 à marque ne se confond pas avec le refus : ses octets nuls ne le refusent pas', () => {
    const octets = enUtf16('nom;prenom', 'le');
    assert.ok(octets.slice(0, 4096).includes(0));
    assert.deepEqual(decoder(octets), { texte: 'nom;prenom', encodage: 'utf-16le' });
  });
});

describe('decoder : un UTF-16 sous sa marque doit être valide (§ 10.1)', () => {
  test("un nombre impair d'octets : refus UTF16_INVALIDE, remède nommé", () => {
    assertRefus(refusDe(Uint8Array.of(0xff, 0xfe, 0x61, 0x00, 0x62)), 'UTF16_INVALIDE');
    assertRefus(refusDe(Uint8Array.of(0xfe, 0xff, 0x00, 0x61, 0x00)), 'UTF16_INVALIDE');
  });

  test('un substitut isolé, haut ou bas, en LE comme en BE : refus UTF16_INVALIDE', () => {
    // Haut suivi d'une lettre, bas seul, haut en fin de fichier.
    assertRefus(refusDe(Uint8Array.of(0xff, 0xfe, 0x00, 0xd8, 0x61, 0x00)), 'UTF16_INVALIDE');
    assertRefus(refusDe(Uint8Array.of(0xff, 0xfe, 0x00, 0xdc)), 'UTF16_INVALIDE');
    assertRefus(refusDe(Uint8Array.of(0xff, 0xfe, 0x61, 0x00, 0x00, 0xd8)), 'UTF16_INVALIDE');
    assertRefus(refusDe(Uint8Array.of(0xfe, 0xff, 0xd8, 0x00, 0x00, 0x61)), 'UTF16_INVALIDE');
    assertRefus(refusDe(Uint8Array.of(0xfe, 0xff, 0xdc, 0x00)), 'UTF16_INVALIDE');
  });

  test('une paire de substitution valide reste lue', () => {
    assert.deepEqual(decoder(Uint8Array.of(0xff, 0xfe, 0x34, 0xd8, 0x1e, 0xdd)), {
      texte: '𝄞',
      encodage: 'utf-16le',
    });
  });
});

describe("decoder : la marque UTF-8 déclare l'encodage (§ 10.1)", () => {
  test("une marque UTF-8 suivie d'octets windows-1252 : refus UTF8_INVALIDE, remède nommé", () => {
    assertRefus(refusDe(avec(MARQUE_UTF8, enWindows1252(BENOIT))), 'UTF8_INVALIDE');
  });

  test("une partie valide en UTF-8 puis un octet isolé : refusée, non lue en windows-1252 où chaque accent de la partie valide deviendrait des caractères parasites", () => {
    const corps = [...enUtf8('Benoît Exemple;Odile Fictive\r\n'), 0xe9];
    // Sans la marque, les mêmes octets se lisent en windows-1252 : « î », en
    // UTF-8 C3 AE, y devient « Ã® », sans que rien n'échoue.
    const sansMarque = decoder(Uint8Array.from(corps));
    assert.equal(sansMarque.encodage, 'windows-1252');
    assert.ok(sansMarque.texte.startsWith('BenoÃ®t'));
    assertRefus(refusDe(avec(MARQUE_UTF8, corps)), 'UTF8_INVALIDE');
  });

  test('une séquence UTF-8 coupée en fin de fichier : refus UTF8_INVALIDE', () => {
    assertRefus(refusDe(avec(MARQUE_UTF8, [...enUtf8('Beno'), 0xc3])), 'UTF8_INVALIDE');
  });
});

describe('decoder : un caractère nul dans le texte décodé est refusé (§ 10.1)', () => {
  test("un UTF-32 LE, que sa marque FF FE 00 00 fait prendre pour de l'UTF-16 LE : refus CARACTERE_NUL, non un texte entrelardé de caractères nuls", () => {
    const octets = enUtf32('nom;prenom\r\nBenoît Exemple;Odile', 'le');
    // Sous la marque UTF-16 LE, ces octets se lisent sans erreur, nuls compris.
    assert.deepEqual([...octets.slice(0, 2)], [0xff, 0xfe]);
    assert.ok(new TextDecoder('utf-16le').decode(octets).includes('\0'));
    assertRefus(refusDe(octets), 'CARACTERE_NUL');
  });

  test('un UTF-32 BE ouvre sur des octets nuls : refusé comme un UTF-16 sans marque', () => {
    assertRefus(refusDe(enUtf32('nom;prenom', 'be')), 'UTF16_SANS_MARQUE');
  });

  // 4 097 octets dont le dernier est nul, donc hors de la sonde des 4 096
  // premiers : de l'UTF-8 valide, ou, avec un octet isolé en tête, du
  // windows-1252.
  function octetsAvecNulLoin(invalideEnUtf8) {
    const octets = new Uint8Array(4097).fill(0x61);
    if (invalideEnUtf8) octets[0] = 0xe9;
    octets[4096] = 0;
    return octets;
  }

  // Un caractère nul est refusé quel que soit le temps qui a décodé le texte.
  // Sous une marque, les premiers octets portent le caractère nul, ou, en
  // UTF-16, des octets nuls : la marque prime sur la recherche de l'octet nul,
  // et le refus nomme le caractère, non un UTF-16 sans marque.
  const AVEC_NUL = [
    ['UTF-8 avec marque', avec(MARQUE_UTF8, enUtf8('a\0b'))],
    ['UTF-16 LE avec marque', enUtf16('a\0b', 'le')],
    ['UTF-16 BE avec marque', enUtf16('a\0b', 'be')],
    ['UTF-8 sans marque, le nul hors de la sonde', octetsAvecNulLoin(false)],
    ['windows-1252, le nul hors de la sonde', octetsAvecNulLoin(true)],
  ];

  for (const [libelle, octets] of AVEC_NUL) {
    test(`${libelle} : un caractère nul dans le texte décodé est refusé, remède nommé`, () => {
      assertRefus(refusDe(octets), 'CARACTERE_NUL');
    });
  }

  test('seul le caractère nul est refusé : les autres caractères de commande passent', () => {
    const texte = 'a\tb\r\nc\u0001d\u007f';
    assert.deepEqual(decoder(enUtf8(texte)), { texte, encodage: 'utf-8' });
  });

  test('chaque refus porte ses propres détails', () => {
    const premier = refusDe(enUtf16(BENOIT, 'le', false));
    const second = refusDe(enUtf16(BENOIT, 'le', false));
    assert.notEqual(premier.details, second.details);
    premier.details.remede = 'AUTRE';
    assert.equal(second.details.remede, 'ENREGISTRER_EN_UTF8');
  });
});

describe('contientNul', () => {
  test("vrai quand le texte porte U+0000, où qu'il soit", () => {
    for (const texte of ['\0', 'a\0', '\0a', 'a\0b', 'nom;prenom\r\nBenoît\0;Exemple']) {
      assert.equal(contientNul(texte), true, JSON.stringify(texte));
    }
  });

  test('faux sans U+0000, les autres caractères de commande, le chiffre zéro et la barre oblique inverse comprises', () => {
    for (const texte of ['', 'Benoît', 'a\tb\r\nc\u0001d\u007f', '0', '\\0', '\u2400']) {
      assert.equal(contientNul(texte), false, JSON.stringify(texte));
    }
  });
});

describe('ErreurCsv', () => {
  test('porte son code, ses détails et un message en JSON', () => {
    const erreur = new ErreurCsv('UN_CODE', { cle: 1 });
    assert.ok(erreur instanceof Error);
    assert.equal(erreur.name, 'ErreurCsv');
    assert.equal(erreur.code, 'UN_CODE');
    assert.deepEqual(erreur.details, { cle: 1 });
    assert.equal(erreur.message, 'UN_CODE {"cle":1}');
  });

  test('sans détails, ses détails sont un objet vide', () => {
    assert.deepEqual(new ErreurCsv('SANS_DETAIL').details, {});
  });
});
