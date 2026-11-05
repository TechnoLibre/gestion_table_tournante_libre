// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la lecture d'un texte CSV (§ 10.1, § 14.10) : la découpe en
// enregistrements — guillemets, guillemets doublés, fins de ligne, ligne vide,
// guillemet resté ouvert —, le choix du séparateur sur les vingt premiers
// enregistrements, et la propriété du § 14.12 qui le retrouve dans un tableau
// rendu par construction. Les en-têtes se reconnaissent ici par un double de
// l'épreuve : le choix ne dépend que du verdict, non de la manière de le
// rendre.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import { decoder } from './encodage.js';
import { ErreurCsv } from './erreurs.js';
import { choisirSeparateur, decouper, enregistrementVide } from './lecture.js';

const SEPARATEURS = [';', ',', '\t'];

// Double de la reconnaissance d'en-têtes que reçoit choisirSeparateur : les
// trois noms de colonne, tels quels.
const ENTETES = new Set(['nom', 'prenom', 'organisation']);
const reconnaitre = (entete) => ENTETES.has(entete);

// Une reconnaissance rend un booléen, ou le nom du champ reconnu et null
// sinon : choisirSeparateur n'en lit que la valeur de vérité.
const RECONNAISSANCES = [
  ['qui rend un booléen', reconnaitre],
  ['qui rend le champ reconnu ou null', (entete) => (ENTETES.has(entete) ? entete : null)],
];

// L'erreur que lève fonction ; l'épreuve échoue quand elle ne lève rien.
function erreurDe(fonction) {
  try {
    fonction();
  } catch (erreur) {
    return erreur;
  }
  return assert.fail("rien n'a été levé");
}

// Vérifie que fonction lève le refus d'un séparateur introuvable, avec ses
// détails : le candidat écarté, le rang de l'enregistrement fautif et la
// cause, ou rien quand aucun candidat ne donne à l'en-tête deux champs.
function assertSeparateurIntrouvable(fonction, details = {}) {
  const erreur = erreurDe(fonction);
  assert.ok(erreur instanceof ErreurCsv);
  assert.equal(erreur.code, 'SEPARATEUR_INTROUVABLE');
  assert.deepEqual(erreur.details, details);
}

// Détails d'un refus dont le candidat est écarté par le nombre de champs d'un
// enregistrement, ou par un guillemet resté ouvert.
const ecart = (separateur, ligne) => ({ separateur, ligne, cause: 'NOMBRE_DE_CHAMPS' });
const ouvert = (separateur, ligne) => ({ separateur, ligne, cause: 'GUILLEMET_OUVERT' });

// Enregistrements que decouper rend, une fois vérifié qu'aucun guillemet ne
// reste ouvert.
function enregistrementsDe(texte, separateur = ';') {
  const { enregistrements, guillemetOuvert } = decouper(texte, separateur);
  assert.equal(guillemetOuvert, false);
  return enregistrements;
}

// Nombre de champs de chaque enregistrement que donne le séparateur, guillemet
// resté ouvert ou non.
const largeursLues = (texte, separateur) => decouper(texte, separateur).enregistrements.map((e) => e.length);

// Le même nombre, une fois vérifié qu'aucun guillemet ne reste ouvert.
const largeurs = (texte, separateur) => enregistrementsDe(texte, separateur).map((e) => e.length);

describe('decouper : enregistrements et champs (§ 10.1)', () => {
  test('des champs séparés, une dernière ligne sans fin de ligne', () => {
    assert.deepEqual(decouper('nom;prenom\nBenoît;Exemple', ';'), {
      enregistrements: [
        ['nom', 'prenom'],
        ['Benoît', 'Exemple'],
      ],
      guillemetOuvert: false,
    });
  });

  test('un champ cité garde le séparateur ; deux guillemets y font un guillemet', () => {
    assert.deepEqual(enregistrementsDe('nom;notes\r\nBenoît Exemple;"a ; b ""c"" d"\r\n'), [
      ['nom', 'notes'],
      ['Benoît Exemple', 'a ; b "c" d'],
    ]);
  });

  test('un champ cité sur deux lignes est un seul enregistrement, ses fins de ligne gardées telles quelles', () => {
    assert.deepEqual(enregistrementsDe('nom;notes\r\nBenoît Exemple;"ligne 1\r\nligne 2"\nSuivant;x\r\n'), [
      ['nom', 'notes'],
      ['Benoît Exemple', 'ligne 1\r\nligne 2'],
      ['Suivant', 'x'],
    ]);
    assert.deepEqual(enregistrementsDe('a;"x\ny"'), [['a', 'x\ny']]);
    assert.deepEqual(enregistrementsDe('a;"x\ry"'), [['a', 'x\ry']]);
  });

  test('CRLF, LF ou CR terminent un enregistrement, CRLF comptant pour une seule fin', () => {
    const attendu = [
      ['a', '1'],
      ['b', '2'],
      ['c', '3'],
    ];
    assert.deepEqual(enregistrementsDe('a;1\r\nb;2\r\nc;3'), attendu);
    assert.deepEqual(enregistrementsDe('a;1\nb;2\nc;3'), attendu);
    assert.deepEqual(enregistrementsDe('a;1\rb;2\rc;3'), attendu);
    assert.deepEqual(enregistrementsDe('a;1\r\nb;2\nc;3\r'), attendu);
  });

  test('la dernière ligne, avec ou sans fin de ligne, donne les mêmes enregistrements', () => {
    for (const fin of ['', '\n', '\r\n', '\r']) {
      assert.deepEqual(enregistrementsDe(`a;b${fin}`), [['a', 'b']], JSON.stringify(fin));
    }
  });

  test("une ligne vide au milieu est un enregistrement d'un champ vide, qui garde son rang", () => {
    assert.deepEqual(enregistrementsDe('nom;prenom\r\n\r\nBenoît;Exemple\r\n'), [
      ['nom', 'prenom'],
      [''],
      ['Benoît', 'Exemple'],
    ]);
  });

  test("un enregistrement se désigne par son rang à partir de 1, l'en-tête compris : celui d'une ligne de tableur", () => {
    const texte = [
      'nom;notes', // rang 1
      'Benoît Exemple;1', // rang 2
      '', // rang 3 : ligne vide
      'Odile Fictive;"deux\nlignes"', // rang 4 : une cellule, une seule ligne de tableur
      'Rémi Témoin;3', // rang 5
    ].join('\r\n');
    const enregistrements = enregistrementsDe(texte);
    const rang = (n) => enregistrements[n - 1];
    assert.equal(enregistrements.length, 5);
    assert.deepEqual(rang(1), ['nom', 'notes']);
    assert.deepEqual(rang(3), ['']);
    assert.deepEqual(rang(4), ['Odile Fictive', 'deux\nlignes']);
    assert.deepEqual(rang(5), ['Rémi Témoin', '3']);
  });

  test("seule la ligne vide qui suit la dernière fin de ligne n'est pas un enregistrement", () => {
    assert.deepEqual(enregistrementsDe(''), []);
    assert.deepEqual(enregistrementsDe('\n'), [['']]);
    assert.deepEqual(enregistrementsDe('a\n\n'), [['a'], ['']]);
    assert.deepEqual(enregistrementsDe('a\r\n\r\n'), [['a'], ['']]);
  });

  test('un dernier enregistrement réduit à un champ cité vide est un enregistrement, avec ou sans fin de ligne', () => {
    assert.deepEqual(decouper('a\n""', ';'), { enregistrements: [['a'], ['']], guillemetOuvert: false });
    assert.deepEqual(decouper('a\n""\n', ';'), { enregistrements: [['a'], ['']], guillemetOuvert: false });
    assert.deepEqual(decouper('""', ';'), { enregistrements: [['']], guillemetOuvert: false });
  });

  test('un guillemet resté ouvert est signalé, et le texte lu jusque-là est rendu', () => {
    assert.deepEqual(decouper('nom;notes\nBenoît;"jamais fermé\nsuite', ';'), {
      enregistrements: [
        ['nom', 'notes'],
        ['Benoît', 'jamais fermé\nsuite'],
      ],
      guillemetOuvert: true,
    });
  });

  test('un champ cité refermé en toute fin ne laisse rien ouvert, un guillemet doublé en toute fin le laisse ouvert', () => {
    assert.equal(decouper('a;"b"', ';').guillemetOuvert, false);
    assert.equal(decouper('a;"b', ';').guillemetOuvert, true);
    assert.equal(decouper('a;"b""', ';').guillemetOuvert, true);
    assert.equal(decouper('a;"', ';').guillemetOuvert, true);
  });

  test('deux guillemets font un champ cité vide ; quatre, un champ réduit à un guillemet', () => {
    assert.deepEqual(enregistrementsDe('a;"";c'), [['a', '', 'c']]);
    assert.deepEqual(enregistrementsDe('"""";x'), [['"', 'x']]);
  });

  test("un guillemet qui n'ouvre pas un champ est un caractère comme un autre", () => {
    assert.deepEqual(enregistrementsDe('Benoît 5" Exemple;x\nsuite;y'), [
      ['Benoît 5" Exemple', 'x'],
      ['suite', 'y'],
    ]);
    assert.deepEqual(enregistrementsDe('a"b;c'), [['a"b', 'c']]);
  });

  test("un guillemet fermant suivi d'autre chose qu'un séparateur, une fin d'enregistrement ou un second guillemet : la lecture s'arrête, guillemetOuvert", () => {
    // Le champ cité est refusé là où son guillemet fermant est suivi d'un
    // autre caractère ; le dernier enregistrement rendu est celui où le champ
    // s'ouvre, et porte le texte lu jusqu'à ce guillemet.
    assert.deepEqual(decouper('"Benoît" ;x', ';'), { enregistrements: [['Benoît']], guillemetOuvert: true });
    assert.deepEqual(decouper('"a"b;c', ';'), { enregistrements: [['a']], guillemetOuvert: true });
    assert.deepEqual(decouper('nom;notes\nA;"a ""b"" c"x\nB;y\n', ';'), {
      enregistrements: [['nom', 'notes'], ['A', 'a "b" c']],
      guillemetOuvert: true,
    });
    // Sous un séparateur null, seule une fin d'enregistrement suit le
    // guillemet fermant.
    assert.deepEqual(decouper('nom\n"Roy, Camille";x\n', null), {
      enregistrements: [['nom'], ['Roy, Camille']],
      guillemetOuvert: true,
    });
  });

  test("un guillemet égaré qui avale des enregistrements : le champ se referme plus loin sur un autre caractère, la lecture s'arrête au rang où il s'ouvre", () => {
    // Le guillemet qui ouvre la note de A n'est jamais refermé à sa place :
    // celui de « "Bob" » le referme, suivi d'une lettre. Les enregistrements
    // de B et de C ne se fondent pas dans la note de A.
    const texte = 'nom;prenom;notes\r\nA;Pa;"VIP au fond\r\nB;Pb;\r\nC;Pc;surnommé "Bob" par tous\r\nD;Pd;\r\n';
    assert.deepEqual(decouper(texte, ';'), {
      enregistrements: [
        ['nom', 'prenom', 'notes'],
        ['A', 'Pa', 'VIP au fond\r\nB;Pb;\r\nC;Pc;surnommé '],
      ],
      guillemetOuvert: true,
    });
  });

  test('un guillemet fermant suivi du séparateur, de CR, de LF, de CRLF ou de la fin du texte referme le champ', () => {
    assert.deepEqual(enregistrementsDe('"a";b'), [['a', 'b']]);
    assert.deepEqual(enregistrementsDe('"a"\rb'), [['a'], ['b']]);
    assert.deepEqual(enregistrementsDe('"a"\nb'), [['a'], ['b']]);
    assert.deepEqual(enregistrementsDe('"a"\r\nb'), [['a'], ['b']]);
    assert.deepEqual(enregistrementsDe('x;"a"'), [['x', 'a']]);
    assert.deepEqual(enregistrementsDe('x\t"a"\ty', '\t'), [['x', 'a', 'y']]);
    assert.deepEqual(enregistrementsDe('"a"\nb', null), [['a'], ['b']]);
  });

  test('les blancs autour des valeurs sont rendus tels quels, cités ou non', () => {
    assert.deepEqual(enregistrementsDe(' Benoît ; Exemple ;" Odile "'), [[' Benoît ', ' Exemple ', ' Odile ']]);
  });

  test('les champs vides, aux deux bouts comme au milieu', () => {
    assert.deepEqual(enregistrementsDe(';a;;b;'), [['', 'a', '', 'b', '']]);
    assert.deepEqual(enregistrementsDe(';;'), [['', '', '']]);
  });

  test('la tabulation sépare, et se cite comme tout séparateur', () => {
    assert.deepEqual(enregistrementsDe('nom\tprenom\nExemple\t"a\tb"', '\t'), [
      ['nom', 'prenom'],
      ['Exemple', 'a\tb'],
    ]);
  });

  test('sans séparateur (null), chaque enregistrement est un seul champ, virgules et points-virgules compris', () => {
    assert.deepEqual(enregistrementsDe('nom\nBenoît Exemple, Odile\n"Rémi; ""R"""', null), [
      ['nom'],
      ['Benoît Exemple, Odile'],
      ['Rémi; "R"'],
    ]);
  });
});

describe('enregistrementVide', () => {
  test('vrai quand chaque champ est vide ou réduit à des blancs', () => {
    assert.equal(enregistrementVide(['']), true);
    assert.equal(enregistrementVide(['', '', '']), true);
    assert.equal(enregistrementVide([' ', '\t']), true);
  });

  test("faux dès qu'un champ porte un caractère", () => {
    assert.equal(enregistrementVide(['', 'a']), false);
    assert.equal(enregistrementVide(['0']), false);
  });
});

describe('choisirSeparateur : le candidat retenu (§ 10.1)', () => {
  test("un fichier séparé par des virgules : « ; » est écarté parce qu'il donne un champ, non faute de constance", () => {
    // « ; » donne un champ à chaque enregistrement : la constance seule le
    // retiendrait, et, sans en-tête reconnu pour départager, l'ordre des
    // candidats le placerait devant « , ».
    const texte = 'a,b,c\n1,2,3\n';
    assert.deepEqual(largeurs(texte, ';'), [1, 1]);
    assert.deepEqual(choisirSeparateur(texte, () => false), { separateur: ',' });
  });

  test('un fichier séparé par des virgules, ses en-têtes reconnus', () => {
    const texte = 'nom,prenom,organisation\nBenoît,Exemple,Groupe Azur\nOdile,Fictive,Groupe Ambre\n';
    assert.deepEqual(choisirSeparateur(texte, reconnaitre), { separateur: ',' });
  });

  test('un collage de tableur est séparé par des tabulations, même quand un champ porte une virgule', () => {
    const texte = 'nom\tprenom\torganisation\nBenoît\tExemple\tGroupe Azur, nord\nOdile\tFictive\tGroupe Ambre\n';
    assert.deepEqual(largeurs(texte, ','), [1, 2, 1]);
    assert.deepEqual(choisirSeparateur(texte, reconnaitre), { separateur: '\t' });
  });

  // « ; » donne deux champs, « , » trois, l'un et l'autre constants : seule la
  // reconnaissance des en-têtes les départage.
  const TEXTE_A_EGALITE = 'nom,prenom,organisation;x\nBenoît,Exemple,Groupe Azur;y\n';

  for (const [libelle, reconnaissance] of RECONNAISSANCES) {
    test(`égalité de constance : le candidat aux plus d'en-têtes reconnus, fût-il le dernier essayé (reconnaissance ${libelle})`, () => {
      assert.deepEqual(largeurs(TEXTE_A_EGALITE, ';'), [2, 2]);
      assert.deepEqual(largeurs(TEXTE_A_EGALITE, ','), [3, 3]);
      // « , » reconnaît deux en-têtes (nom, prenom), « ; » aucun.
      assert.deepEqual(choisirSeparateur(TEXTE_A_EGALITE, reconnaissance), { separateur: ',' });
    });
  }

  test("la même égalité, une reconnaissance qui favorise l'autre lecture : le choix suit le verdict", () => {
    const lectureParPointVirgule = (entete) => entete === 'x' || entete === 'nom,prenom,organisation';
    assert.deepEqual(choisirSeparateur(TEXTE_A_EGALITE, lectureParPointVirgule), { separateur: ';' });
  });

  test("égalité complète : l'ordre « ; », « , », tabulation départage", () => {
    const aucune = () => false;
    assert.deepEqual(choisirSeparateur('a,b;c\nd,e;f\n', aucune), { separateur: ';' });
    assert.deepEqual(choisirSeparateur('a,b\tc\nd,e\tf\n', aucune), { separateur: ',' });
  });

  test("un en-tête non reconnu n'écarte pas le candidat : la reconnaissance ne fait que départager", () => {
    assert.deepEqual(choisirSeparateur('a;b\nc;d\n', () => false), { separateur: ';' });
  });

  test("reconnaitre reçoit les champs du premier enregistrement non vide, tels qu'écrits", () => {
    const appels = [];
    choisirSeparateur('\n Nom ;prenom\nA;B\n', (entete) => {
      appels.push(entete);
      return false;
    });
    assert.deepEqual(appels, [' Nom ', 'prenom']);
  });

  test("une colonne d'en-tête vide compte comme un champ", () => {
    assert.deepEqual(choisirSeparateur('nom;;organisation\nBenoît;;Groupe Azur\n', reconnaitre), { separateur: ';' });
    assert.deepEqual(choisirSeparateur('nom;prenom;\nBenoît;Exemple;\n', reconnaitre), { separateur: ';' });
  });

  test('un fichier réduit à son en-tête donne son séparateur', () => {
    assert.deepEqual(choisirSeparateur('nom;prenom', reconnaitre), { separateur: ';' });
  });

  test('les enregistrements vides — ligne vide, champs vides, blancs seuls — ne rompent pas la constance', () => {
    const texte = 'nom;prenom\r\n\r\nBenoît;Exemple\r\n;\r\n   \r\nOdile;Fictive\r\n';
    assert.deepEqual(choisirSeparateur(texte, reconnaitre), { separateur: ';' });
  });

  describe('la fenêtre des vingt premiers enregistrements', () => {
    // Vingt-cinq enregistrements de trois champs, dont celui du rang donné,
    // à partir de 1, est remplacé.
    const texteAvec = (rang, remplacement) => {
      const lignes = [
        'nom;prenom;organisation',
        ...Array.from({ length: 24 }, (_, i) => `n${i};p${i};a${i}`),
      ];
      lignes[rang - 1] = remplacement;
      return lignes.join('\n');
    };

    test('un enregistrement plus long au rang 20 écarte « ; », au rang 21 non', () => {
      assertSeparateurIntrouvable(() => choisirSeparateur(texteAvec(20, 'x;y;z;t'), reconnaitre), ecart(';', 20));
      assert.deepEqual(choisirSeparateur(texteAvec(21, 'x;y;z;t'), reconnaitre), { separateur: ';' });
    });

    test('un enregistrement plus court au rang 20 écarte « ; », au rang 21 non', () => {
      assertSeparateurIntrouvable(() => choisirSeparateur(texteAvec(20, 'x;y'), reconnaitre), ecart(';', 20));
      assert.deepEqual(choisirSeparateur(texteAvec(21, 'x;y'), reconnaitre), { separateur: ';' });
    });

    test('un guillemet resté ouvert depuis le rang 20 écarte « ; », depuis le rang 21 non', () => {
      // Le dernier champ de l'enregistrement avale la fin du fichier : le
      // nombre de champs reste trois, seul le guillemet ouvert écarte « ; ».
      const guillemet = 'x;y;"ouvert';
      assert.deepEqual(largeursLues(texteAvec(20, guillemet), ';'), new Array(20).fill(3));
      assertSeparateurIntrouvable(() => choisirSeparateur(texteAvec(20, guillemet), reconnaitre), ouvert(';', 20));
      const texte = texteAvec(21, guillemet);
      assert.deepEqual(choisirSeparateur(texte, reconnaitre), { separateur: ';' });
      // Le découpage du fichier entier, lui, voit le guillemet resté ouvert.
      assert.equal(decouper(texte, ';').guillemetOuvert, true);
    });
  });
});

describe('choisirSeparateur : un fichier à une seule colonne (§ 10.1)', () => {
  test('une colonne « nom » dont une ligne porte une virgule : une colonne, la virgule gardée dans le nom', () => {
    const texte = 'nom\nBenoît Exemple, Odile\nRémi Témoin\n';
    // La virgule donne un champ, puis deux, puis un : elle n'est pas constante.
    assert.deepEqual(largeurs(texte, ','), [1, 2, 1]);
    assert.deepEqual(choisirSeparateur(texte, reconnaitre), { separateur: null });
    assert.deepEqual(enregistrementsDe(texte, null), [['nom'], ['Benoît Exemple, Odile'], ['Rémi Témoin']]);
  });

  test("la première ligne entière, ses blancs de bord retirés, est celle qu'on reconnaît", () => {
    assert.deepEqual(choisirSeparateur('  nom \nBenoît Exemple\n', reconnaitre), { separateur: null });
  });

  test("une ligne vide avant l'en-tête n'empêche pas de le reconnaître", () => {
    assert.deepEqual(choisirSeparateur('\r\n nom\r\nBenoît Exemple\r\n', reconnaitre), { separateur: null });
  });

  test('un en-tête cité se reconnaît comme le même sans guillemets', () => {
    assert.deepEqual(choisirSeparateur('"nom"\nBenoît Exemple\n', reconnaitre), { separateur: null });
  });

  test("une colonne unique n'est retenue que faute de candidat", () => {
    assert.deepEqual(choisirSeparateur('nom;prenom\nBenoît;Exemple\n', reconnaitre), { separateur: ';' });
  });
});

describe('choisirSeparateur : le séparateur introuvable (§ 10.1)', () => {
  test("une seule colonne dont la première ligne n'est pas un en-tête reconnu", () => {
    assertSeparateurIntrouvable(() => choisirSeparateur('Benoît Exemple\nOdile Fictive\n', reconnaitre));
  });

  test('un nombre de champs qui varie, pour chaque candidat : un enregistrement plus long', () => {
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom\nBenoît;Exemple;Groupe Azur\n', reconnaitre),
      ecart(';', 2),
    );
  });

  test("un nombre de champs qui varie, pour chaque candidat : un enregistrement plus court, jusqu'à un seul champ", () => {
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom;organisation\nBenoît;Exemple\n', reconnaitre),
      ecart(';', 2),
    );
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom\nBenoît;Exemple\nune ligne sans séparateur\n', reconnaitre),
      ecart(';', 3),
    );
  });

  test('un guillemet resté ouvert dans les premiers enregistrements, même quand le nombre de champs reste constant', () => {
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom\n"Benoît;Exemple\nOdile;Fictive\n', reconnaitre),
      ouvert(';', 2),
    );
    // Deux champs partout, mais le second de la dernière ligne avale la fin du
    // fichier : seul le guillemet resté ouvert écarte « ; ».
    const texte = 'nom;prenom\nBenoît;"Exemple\nOdile;Fictive\n';
    const lu = decouper(texte, ';');
    assert.deepEqual(lu.enregistrements.map((e) => e.length), [2, 2]);
    assert.equal(lu.guillemetOuvert, true);
    assertSeparateurIntrouvable(() => choisirSeparateur(texte, reconnaitre), ouvert(';', 2));
  });

  test("un guillemet fermant suivi d'un autre caractère dans la fenêtre écarte le candidat, au rang où le champ s'ouvre", () => {
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom\nBenoît;Exemple\nOdile;"Fictive"x\nRémi;Témoin\n', reconnaitre),
      ouvert(';', 3),
    );
    // Le champ s'ouvre au rang 2 et avale les rangs 3 et 4 avant de se
    // refermer sur une lettre : le rang nommé est celui où il s'ouvre.
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom\nBenoît;"Exemple\nOdile;Fictive\nRémi;dit "R" ici\n', reconnaitre),
      ouvert(';', 2),
    );
  });

  test('un texte vide, ou fait de lignes vides', () => {
    assertSeparateurIntrouvable(() => choisirSeparateur('', reconnaitre));
    assertSeparateurIntrouvable(() => choisirSeparateur('\r\n\r\n', reconnaitre));
  });

  test("le refus nomme le premier défaut dans l'ordre du texte, à son rang, les enregistrements vides comptés", () => {
    // Un enregistrement plus court passe avant le guillemet ouvert qui le suit.
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom;organisation\nBenoît;Exemple\nOdile;"Fictive\n', reconnaitre),
      ecart(';', 2),
    );
    // Une ligne vide et une ligne de séparateurs seuls ne rompent rien, mais
    // comptent dans le rang : le numéro de ligne qu'un tableur donne.
    assertSeparateurIntrouvable(
      () => choisirSeparateur('\nnom;prenom\n\n;\nBenoît;Exemple;x\n', reconnaitre),
      ecart(';', 5),
    );
    // Sans écart, le guillemet ouvert, au rang de l'enregistrement où il
    // s'ouvre ; ce qui le suit tient dans son champ.
    assertSeparateurIntrouvable(
      () => choisirSeparateur('nom;prenom\nBenoît;Exemple\n\nOdile;"Fictive\nRémi;Témoin\n', reconnaitre),
      ouvert(';', 4),
    );
  });

  test("parmi les candidats écartés, le refus nomme celui aux plus d'en-têtes reconnus, puis le premier dans l'ordre", () => {
    // « ; » et « , » donnent deux champs à l'en-tête, et chacun s'écarte sur
    // son propre enregistrement : « , » au rang 2, « ; » au rang 3. Sous « , »,
    // « prenom » est reconnu ; sous « ; », rien.
    const texte = 'x;nom,prenom\na;b,c,d\ne;f;g\n';
    assertSeparateurIntrouvable(() => choisirSeparateur(texte, reconnaitre), ecart(',', 2));
    assertSeparateurIntrouvable(() => choisirSeparateur(texte, () => false), ecart(';', 3));
    // Un guillemet en tête de ligne s'ouvre sous chaque candidat.
    assertSeparateurIntrouvable(() => choisirSeparateur('a;b,c\n"d;e,f\n', () => false), ouvert(';', 2));
    assertSeparateurIntrouvable(() => choisirSeparateur('a,b\tc\n"d,e\tf\n', () => false), ouvert(',', 2));
  });

  test("aucun candidat ne donne à l'en-tête deux champs : le refus ne nomme rien", () => {
    // Une colonne d'en-tête inconnu ; un séparateur hors des candidats ; un
    // guillemet ouvert dès l'en-tête, qui n'en termine aucun ; vingt lignes
    // vides, qui laissent la fenêtre sans en-tête.
    const textes = [
      'Benoît Exemple\n"Odile Fictive\n',
      'nom|prenom\nBenoît|"Exemple\n',
      'nom;"prenom\nBenoît;Exemple\n',
      `${'\n'.repeat(20)}nom;prenom\nBenoît;Exemple;x\n`,
    ];
    for (const texte of textes) {
      assertSeparateurIntrouvable(() => choisirSeparateur(texte, reconnaitre));
    }
  });

  test('un fichier à une colonne dont la ligne entière est un en-tête reconnu passe avant un candidat écarté', () => {
    // « ; » donne deux champs à l'en-tête, puis trois : il est écarté au rang 2.
    const reconnaitreLigne = (entete) => entete === 'nom;prenom';
    assert.deepEqual(choisirSeparateur('nom;prenom\nBenoît;Exemple;x\n', reconnaitreLigne), { separateur: null });
  });
});

describe("de l'octet à l'enregistrement : un CSV tel qu'un tableur l'écrit", () => {
  test('marque UTF-8 et CRLF, champ cité à guillemets doublés, ligne vide, blancs, colonne sans en-tête, dernière ligne sans fin', () => {
    const texteTableur = [
      'nom;prenom;organisation;;notes',
      'Exemple;Benoît;Groupe Azur;;"dit ""bonjour"" ; puis part"',
      '',
      ' Fictif ; Odile ;;;',
      'Témoin;Rémi;Groupe Ambre;;fin',
    ].join('\r\n');
    const octets = Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(texteTableur)]);

    const { texte, encodage } = decoder(octets);
    assert.equal(encodage, 'utf-8-bom');
    const { separateur } = choisirSeparateur(texte, reconnaitre);
    assert.equal(separateur, ';');
    assert.deepEqual(decouper(texte, separateur), {
      enregistrements: [
        ['nom', 'prenom', 'organisation', '', 'notes'],
        ['Exemple', 'Benoît', 'Groupe Azur', '', 'dit "bonjour" ; puis part'],
        [''],
        [' Fictif ', ' Odile ', '', '', ''],
        ['Témoin', 'Rémi', 'Groupe Ambre', '', 'fin'],
      ],
      guillemetOuvert: false,
    });
  });
});

describe('choisirSeparateur et decouper : propriété par construction (§ 14.12)', () => {
  // Graine fixée, écrite ici : un contre-exemple se rejoue.
  const GRAINE = 161_803;
  const TIRAGES = 300;

  // Unités des champs engendrés : trois fois sur quatre une lettre, un accent
  // ou un blanc, sinon un guillemet, une fin de ligne ou le séparateur connu,
  // qui forcent la citation. Les deux autres candidats en sont absents : un
  // tableau qui les porte se lit de plusieurs façons, et le départage par les
  // en-têtes s'éprouve à part.
  const unite = (separateur) =>
    fc.oneof(
      { arbitrary: fc.constantFrom('a', 'Z', 'é', ' '), weight: 3 },
      { arbitrary: fc.constantFrom('"', '\n', '\r', separateur), weight: 1 },
    );
  const champ = (separateur) => fc.string({ unit: unite(separateur), maxLength: 6 });

  // Un champ qui commence par une lettre n'est jamais vide, même une fois ses
  // blancs retirés : aucun enregistrement du tableau n'est un enregistrement
  // vide, que le choix du séparateur ignore.
  const premierChamp = (separateur) =>
    fc
      .tuple(fc.constantFrom('a', 'Z', 'é'), champ(separateur))
      .map(([tete, suite]) => tete + suite);

  // Un tableau de 1 à 25 enregistrements, de 2 à 5 champs chacun, et la
  // manière de l'écrire : séparateur, fin de ligne, fin de ligne finale ou non.
  const cas = fc.constantFrom(...SEPARATEURS).chain((separateur) =>
    fc.record({
      separateur: fc.constant(separateur),
      tableau: fc.integer({ min: 2, max: 5 }).chain((largeur) =>
        fc.array(
          fc
            .tuple(premierChamp(separateur), fc.array(champ(separateur), { minLength: largeur - 1, maxLength: largeur - 1 }))
            .map(([premier, autres]) => [premier, ...autres]),
          { minLength: 1, maxLength: 25, size: 'max' },
        ),
      ),
      fin: fc.constantFrom('\r\n', '\n', '\r'),
      finale: fc.boolean(),
    }),
  );

  // Écrit le tableau comme un tableur : un champ qui porte le séparateur, un
  // guillemet ou une fin de ligne se cite, ses guillemets doublés.
  function ecrire({ separateur, tableau, fin, finale }) {
    const ecrireChamp = (valeur) =>
      valeur.includes(separateur) || /["\r\n]/.test(valeur) ? `"${valeur.replaceAll('"', '""')}"` : valeur;
    const lignes = tableau.map((ligne) => ligne.map(ecrireChamp).join(separateur));
    return lignes.join(fin) + (finale ? fin : '');
  }

  test('le séparateur est retrouvé, et le découpage rend le tableau', () => {
    const bilan = { tirages: 0, separateurCite: 0, champSurPlusieursLignes: 0, auDelaDeLaFenetre: 0 };
    fc.assert(
      fc.property(cas, (tirage) => {
        const texte = ecrire(tirage);
        bilan.tirages += 1;
        const champs = tirage.tableau.flat();
        if (champs.some((valeur) => valeur.includes(tirage.separateur))) bilan.separateurCite += 1;
        if (champs.some((valeur) => /[\r\n]/.test(valeur))) bilan.champSurPlusieursLignes += 1;
        if (tirage.tableau.length > 20) bilan.auDelaDeLaFenetre += 1;
        assert.deepEqual(choisirSeparateur(texte, () => false), { separateur: tirage.separateur });
        assert.deepEqual(decouper(texte, tirage.separateur), {
          enregistrements: tirage.tableau,
          guillemetOuvert: false,
        });
      }),
      { seed: GRAINE, numRuns: TIRAGES },
    );
    // Un générateur qui n'engendre pas les cas difficiles rend la propriété
    // vraie sans rien éprouver : chaque famille de cas a son plancher.
    assert.equal(bilan.tirages, TIRAGES);
    assert.ok(bilan.separateurCite >= 100, `séparateur cité : ${bilan.separateurCite}`);
    assert.ok(bilan.champSurPlusieursLignes >= 100, `champ sur plusieurs lignes : ${bilan.champSurPlusieursLignes}`);
    assert.ok(bilan.auDelaDeLaFenetre >= 20, `au-delà de la fenêtre : ${bilan.auDelaDeLaFenetre}`);
  });
});
