// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La planche dans la séance (§ 11.2, § 11.6, § 11.8, § 8.4, § 8.6, § 9) :
// préparer annonce, produire dépose le PDF à côté des fichiers d'événement
// — ou le télécharge sous web —, enregistrer sous le confie au dialogue.
// Sortir n'est pas modifier (contrainte 24) : en lecture, sur un plan
// bloqué, sous un format plus récent, la trace des écritures du système
// d'épreuve ne porte que le .pdf ; un refus n'écrit rien ; l'écriture du PDF
// refusée se dit PLANCHE_NON_ECRITE, sans rompre le support de l'événement.
//
// La série surveillée borne le coût (§ 14.4, contrainte 31) : douze
// productions de PDF au plus dans ce fichier, sur une soirée de quatre
// personnes — trois pour les trois modes, deux pour la stabilité des
// octets, une réédition, deux refus d'écriture et l'enregistrement sous,
// une sous web, deux propositions de la même génération. L'imposition et
// l'ordre se lisent dans la place de chaque nom, et le papier, l'imposition
// et le nombre de planches dans la feuille de contrôle : la première
// production, sous la demande par défaut, en A4 — l'ordre alphabétique ; la
// proposition, sous la demande par défaut, en Lettre — feuille par feuille
// sur deux planches ; celle sous web en Lettre, en pile, par table. La
// réédition porte un caractère sans glyphe, que sa feuille de contrôle
// nomme. Le témoin de 257 ne s'analyse que pour son annonce. Les noms sont
// inventés ; la version vient du module engendré.
import assert from 'node:assert/strict';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { H_PROPOSITION, H_RETENU, personne, soiree, table } from '../../test/fixtures/badges/cas.js';
import { FORME_TEMOIN, chargeTemoin } from '../../test/fixtures/badges/temoin.js';
import { describe, test } from '../../test/lanceur.js';
import { lirePdf } from '../../test/pdf.js';
import { lirePolices } from '../../test/polices.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { cellules } from '../pdf/imposition.js';
import { serialiser } from '../stockage/canonique.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { creer as creerDansLeDepot } from '../stockage/depot.js';
import { FORMAT } from '../stockage/document.js';
import { SUFFIXES, deriverBase, nomPlanche } from '../stockage/noms.js';
import { VERSION } from '../version.genere.js';
import { libelle } from './libelles.js';
import { creerSeance } from './seance.js';

const V1 = VERSION.affichee;
const DOCUMENTS = 'D:\\Soirees\\Gestion table tournante Libre';
const DOC = { id: 'documents', chemin: DOCUMENTS };
const BASE = 'Soirée des Lucioles';
const POLICES = lirePolices();
const FILIGRANE = libelle('planche.brouillon');

// Les primitives qui écrivent, et enregistrerSous, que la trace consigne.
const ECRITURES = [
  'sonder',
  'ecrireAtomique',
  'ecrireOctetsAtomique',
  'ajouterLigne',
  'creerDossier',
  'deplacer',
  'supprimer',
  'verrouiller',
  'deverrouiller',
  'enregistrerSous',
];

// Enveloppe chaque primitive d'écriture du système : la trace reçoit
// [primitive, chemin], le nom proposé pour enregistrerSous.
function tracer(fs) {
  const trace = [];
  for (const nom of ECRITURES) {
    const primitive = fs[nom];
    fs[nom] = (...args) => {
      trace.push([nom, nom === 'enregistrerSous' ? args[0] : args[1]]);
      return primitive(...args);
    };
  }
  return trace;
}

// Horloge d'épreuve : une minute de plus à chaque lecture, le matin de la
// soirée — jamais l'instant d'un placement construit.
function creerHorloge() {
  let n = 0;
  return {
    horodatage() {
      n += 1;
      return `2031-05-17T08:${String(n).padStart(2, '0')}:00-04:00`;
    },
  };
}

// Quatre personnes, deux tables de deux places, deux tours ; le retenu vient
// de la proposition 1, la proposition 2 en est une autre.
const PLAN = [{ sieges: [[1, 2], [3, 4]] }, { sieges: [[1, 3], [2, 4]] }];
const AUTRE_PLAN = [{ sieges: [[1, 4], [2, 3]] }, { sieges: [[1, 2], [3, 4]] }];
function chargeLucioles({ personnes = null, ...champs } = {}) {
  return soiree({
    personnes: personnes ?? [
      personne(1, 'Iris', 'Ombrelle', { organisation: 'Club des Merles' }),
      personne(2, 'Théo', 'Pervenche'),
      personne(3, 'Ondine', 'Lacasse'),
      personne(4, null, 'Grisaille'),
    ],
    tables: [table(1, 1, 2), table(2, 2, 2)],
    plan: PLAN,
    propositions: [
      [1, PLAN],
      [2, AUTRE_PLAN],
    ],
    ...champs,
  });
}

// Le nom de la planche de la soirée d'essai.
const nomDe = ({ papier = 'A4', imposition = 'feuille', horodatage = H_RETENU, reedition = null, proposition = null, ordre } = {}) =>
  nomPlanche(BASE, { papier, imposition, horodatage, reedition, proposition, ordre });

// Pose l'événement de la charge sur le disque, par le dépôt ; format :
// celui qu'annonce l'en-tête de l'état, FORMAT par défaut.
async function deposer(fs, charge, { format = FORMAT } = {}) {
  fs.deposerDossier('documents');
  if (format === FORMAT) {
    await creerDansLeDepot(fs, DOC, charge, {
      libelle: libelle('ENTREE_CREATION', { nom: charge.evenement.nom }),
      nomJalon: libelle('JALON_CREATION'),
      horodatage: '2031-05-17T07:00:00-04:00',
      produitVersion: V1,
    });
    return;
  }
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  fs.deposer('documents', `${BASE}${SUFFIXES.etat}`, texte.replace(`"format":${FORMAT}`, `"format":${format}`));
}

// Une séance sur l'événement de la charge, ouvert en lecture, le papier
// choisi quand il est donné ; la trace part ensuite, vide.
async function monter(charge = chargeLucioles(), { papier = 'A4', fs = creerFichiersSimules({ documents: DOCUMENTS }), format, base = BASE } = {}) {
  await deposer(fs, charge, { format });
  let tirage = 0;
  const seance = creerSeance({
    fs,
    racine: DOC,
    horloge: creerHorloge(),
    identifiant: () => {
      tirage += 1;
      return `seance-${tirage}`;
    },
    produitVersion: V1,
    planifier: () => null,
    annuler: () => {},
    polices: async () => POLICES,
    provenance: 'production',
  });
  if (papier !== null) await seance.choisirPapier(papier);
  await seance.ouvrir(base);
  const trace = tracer(fs);
  return { fs, seance, trace };
}

// Le refus attendu d'une promesse : son code, et ses détails quand ils sont
// donnés.
async function refusee(promesse, code, details) {
  await assert.rejects(promesse, (erreur) => {
    assert.equal(erreur.code, code, erreur.message);
    if (details !== undefined) assert.deepEqual(erreur.details, details);
    return true;
  });
}

// Les textes d'une page du PDF relu, et si l'un d'eux s'écrit au trait.
const textesDe = (page) => page.textes.map(({ texte }) => texte);
const auTrait = (pdf) => pdf.pages.some((page) => page.modesTexte.includes(1));

// Les noms d'une page de badges, parmi ceux donnés, cellule par cellule
// dans l'ordre de cellules(papier) ; null pour une cellule où aucun ne se
// lit. Un nom appartient à la cellule qui contient le centre de sa boîte.
const NOMS = ['Iris Ombrelle', 'Théo Pervenche', 'Ondine Lacasse', 'Grisaille'];
function nomsParCellule(page, papier, noms = NOMS) {
  return cellules(papier).map(({ x, y, largeur, hauteur }) => {
    const lus = page.textes
      .filter((t) => noms.includes(t.texte))
      .filter((t) => t.x + t.l / 2 > x && t.x + t.l / 2 < x + largeur && t.y + t.h / 2 > y && t.y + t.h / 2 < y + hauteur)
      .map(({ texte }) => texte);
    assert.ok(lus.length <= 1, `plusieurs noms dans une cellule : ${lus.join(', ')}`);
    return lus[0] ?? null;
  });
}

// Les lignes de la feuille de contrôle qui disent le papier, l'imposition et
// le nombre de planches d'une production.
const lignesDeSortie = ({ papier, imposition, planches }) => [
  libelle('planche.controle.papier', { papier, ...PAPIERS[papier] }),
  libelle('planche.controle.imposition', { imposition }),
  libelle('planche.controle.planches', { planches }),
];
// Celles que porte la page de contrôle relue, parmi les trois.
const sortieLue = (pdf, sortie) => lignesDeSortie(sortie).filter((ligne) => textesDe(pdf.pages[0]).includes(ligne));

describe('planche dans la séance : sortir n’est pas modifier (contrainte 24, § 8.4, § 9)', () => {
  test('produire en lecture, sur un plan bloqué, sous un format plus récent : la trace ne porte que le .pdf, déposé à côté de l’événement', async () => {
    const cas = [
      ['lecture', chargeLucioles(), {}],
      ['bloqué', chargeLucioles({ etat: 'bloque' }), {}],
      ['format plus récent', chargeLucioles(), { format: FORMAT + 1 }],
    ];
    let retenu = null;
    for (const [nom, charge, options] of cas) {
      const { fs, seance, trace } = await monter(charge, options);
      const revision = seance.etat().evenement.revision;
      const attendu = nomDe();
      const annonce = await seance.preparerPlanche();
      assert.deepEqual(
        annonce,
        {
          refus: null,
          papier: 'A4',
          comptes: { participants: 4, exclus: 0, produits: 4 },
          planches: { A4: 1, Lettre: 2 },
          homonymes: [],
          absents: [],
          brouillon: false,
          nom: attendu,
        },
        nom,
      );
      assert.deepEqual(trace, [], `${nom} : préparer écrit`);
      const rendu = await seance.produirePlanche();
      assert.deepEqual(rendu, { chemin: `${DOCUMENTS}\\${attendu}`, nom: attendu }, nom);
      assert.deepEqual(trace, [['ecrireOctetsAtomique', attendu]], nom);
      assert.equal(seance.mode, 'lecture', nom);
      assert.equal(seance.etat().evenement.revision, revision, nom);
      const octets = fs.octets('documents', attendu);
      assert.equal(new TextDecoder().decode(octets.subarray(0, 5)), '%PDF-', nom);
      retenu ??= octets;
    }
    // Le retenu d'un plan retenu ne porte pas le filigrane.
    const pdf = await lirePdf(retenu);
    assert.ok(!pdf.pages.some((page) => textesDe(page).includes(FILIGRANE)));
    assert.equal(auTrait(pdf), false);
    // La demande par défaut : l'ordre alphabétique, par nom puis prénom, sur
    // l'unique planche A4, feuille par feuille.
    const sortie = { papier: 'A4', imposition: 'feuille', planches: 1 };
    assert.deepEqual(sortieLue(pdf, sortie), lignesDeSortie(sortie), textesDe(pdf.pages[0]).join(' | '));
    assert.equal(pdf.pages.length, 2);
    assert.deepEqual(nomsParCellule(pdf.pages[1], 'A4'), ['Grisaille', 'Ondine Lacasse', 'Iris Ombrelle', 'Théo Pervenche']);
  });

  test('sans papier choisi : PAPIER_REQUIS avant toute écriture ; choisi, le nom et l’annonce le portent, et une autre séance de la racine ne le redemande pas', async () => {
    const { fs, seance, trace } = await monter(chargeLucioles(), { papier: null });
    const requis = { code: 'PAPIER_REQUIS', details: { remede: { geste: 'choisirPapier' } } };
    const annonce = await seance.preparerPlanche();
    assert.deepEqual([annonce.refus, annonce.papier, annonce.nom], [requis, null, null]);
    assert.deepEqual(annonce.planches, { A4: 1, Lettre: 2 });
    await refusee(seance.produirePlanche(), 'PAPIER_REQUIS', requis.details);
    assert.deepEqual(trace, []);

    await seance.choisirPapier('Lettre');
    trace.length = 0;
    const lettre = await seance.preparerPlanche({ imposition: 'pile' });
    assert.deepEqual([lettre.refus, lettre.papier, lettre.nom], [null, 'Lettre', nomDe({ papier: 'Lettre', imposition: 'pile' })]);
    const autre = creerSeance({
      fs,
      racine: DOC,
      horloge: creerHorloge(),
      identifiant: () => 'seance-autre',
      produitVersion: V1,
      planifier: () => null,
      annuler: () => {},
      polices: async () => POLICES,
      provenance: 'production',
    });
    await autre.ouvrir(BASE);
    assert.equal((await autre.preparerPlanche()).papier, 'Lettre');
    assert.deepEqual(trace, []);
  });

  test('une demande hors de son domaine lève TypeError ; une sélection inconnue, PARTICIPANT_INCONNU ; sans événement, AUCUN_EVENEMENT — rien ne s’écrit', async () => {
    const { seance, trace } = await monter();
    await assert.rejects(seance.preparerPlanche({ imposition: 'rouleau' }), TypeError);
    await assert.rejects(seance.produirePlanche({ ordre: 'hasard' }), TypeError);
    await assert.rejects(seance.preparerPlanche({ source: 'reservations' }), TypeError);
    await refusee(seance.produirePlanche({ selection: [3, 99] }), 'PARTICIPANT_INCONNU');
    await refusee(seance.preparerPlanche({ source: 'proposition', proposition: 7 }), 'PROPOSITION_INCONNUE');
    await seance.fermer();
    await refusee(seance.preparerPlanche(), 'AUCUN_EVENEMENT');
    await refusee(seance.enregistrerPlancheSous(), 'AUCUN_EVENEMENT');
    assert.deepEqual(trace, []);
  });
});

describe('planche dans la séance : l’annonce (§ 11.2, § 11.5, § 11.8, décision 12)', () => {
  test('le témoin : 65 planches A4 et 129 Lettre, ses comptes, aucun homonyme', async () => {
    const { seance, trace } = await monter(chargeTemoin());
    const annonce = await seance.preparerPlanche();
    const { participants, exclus, produits, planchesA4, planchesLettre } = FORME_TEMOIN;
    assert.deepEqual(annonce.planches, { A4: planchesA4, Lettre: planchesLettre });
    assert.deepEqual(annonce.comptes, { participants, exclus, produits });
    assert.deepEqual([annonce.refus, annonce.homonymes, annonce.absents, annonce.brouillon], [null, [], [], false]);
    assert.deepEqual(trace, []);
  });

  test('les homonymes que rien ne sépare sont nommés ; un nom à glyphe absent, « Ondine 李 », nomme le caractère', async () => {
    const charge = chargeLucioles({
      personnes: [
        personne(1, 'Iris', 'Ombrelle', { organisation: 'Club des Merles' }),
        personne(2, 'Iris', 'Ombrelle', { organisation: 'Club des Merles' }),
        personne(3, 'Ondine', '李'),
        personne(4, null, 'Grisaille'),
      ],
    });
    const { seance } = await monter(charge);
    const annonce = await seance.preparerPlanche();
    assert.equal(annonce.refus, null);
    assert.deepEqual(annonce.homonymes, [{ nom: 'Iris Ombrelle', ids: [1, 2] }]);
    assert.deepEqual(annonce.absents, ['李']);
  });

  test('une proposition s’annonce BROUILLON, sous son propre horodatage ; sans placement, PLANCHE_SANS_PLACEMENT et rien du modèle', async () => {
    const { seance } = await monter();
    const proposee = await seance.preparerPlanche({ source: 'proposition', proposition: 2 });
    assert.deepEqual([proposee.refus, proposee.brouillon, proposee.nom], [null, true, nomDe({ horodatage: H_PROPOSITION, proposition: 2 })]);
    assert.notEqual((await seance.preparerPlanche({ source: 'proposition', proposition: 1 })).nom, proposee.nom);
    assert.equal((await seance.preparerPlanche({ ordre: 'table' })).nom, nomDe({ ordre: 'table' }));

    const sans = await monter(chargeLucioles({ plan: null, etat: 'propose' }));
    const annonce = await sans.seance.preparerPlanche();
    assert.deepEqual(annonce, {
      refus: { code: 'PLANCHE_SANS_PLACEMENT', details: { remede: { geste: 'ouvrirSection', section: 'propositions' } } },
      papier: 'A4',
      comptes: null,
      planches: null,
      homonymes: [],
      absents: [],
      brouillon: true,
      nom: null,
    });
    await refusee(sans.seance.produirePlanche(), 'PLANCHE_SANS_PLACEMENT');
    await assert.rejects(sans.seance.preparerPlanche({ ordre: 'hasard' }), TypeError);
    assert.deepEqual(sans.trace, []);
  });

  test('dérive : PLANCHE_DERIVE nomme la personne, avant le papier, et rien ne s’écrit', async () => {
    const charge = chargeLucioles();
    charge.participants.push(personne(5, 'Aube', 'Sarcelle'));
    charge.prochainsIds.participant = 6;
    const { seance, trace } = await monter(charge, { papier: null });
    const annonce = await seance.preparerPlanche();
    assert.equal(annonce.refus.code, 'PLANCHE_DERIVE');
    assert.deepEqual(annonce.refus.details.raisons, [{ code: 'PARTICIPANT_NON_PLACE', participant: 5, personne: 'Aube Sarcelle' }]);
    await refusee(seance.produirePlanche(), 'PLANCHE_DERIVE');
    assert.deepEqual(trace, []);
  });

  test('un nom trop long pour son badge : PLANCHE_NOM_TROP_LONG nomme la personne du badge refusé, pas celle de son rang dans la liste', async () => {
    const long = `Pervenche${'w'.repeat(1990)}`;
    const charge = chargeLucioles();
    charge.participants[1].nom = long;
    const { seance, trace } = await monter(charge);
    const details = { participant: 2, personne: `Théo ${long}`, remede: { geste: 'ouvrirSection', section: 'participants' } };
    const annonce = await seance.preparerPlanche();
    assert.deepEqual(annonce.refus, { code: 'PLANCHE_NOM_TROP_LONG', details });
    await refusee(seance.produirePlanche(), 'PLANCHE_NOM_TROP_LONG', details);
    assert.deepEqual(trace, []);
  });
});

describe('planche dans la séance : les octets et le nom (§ 11.6, § 11.8)', () => {
  test('deux productions du même placement : mêmes octets, même nom ; un geste lancé pendant la seconde attend son tour ; la retouche change le nom ; défaire rend la charge, donc le premier', async () => {
    const { fs, seance, trace } = await monter();
    const premier = await seance.produirePlanche();
    const octetsPremiers = fs.octets('documents', premier.nom);
    await seance.passerEnEcriture();
    const chargePremiere = structuredClone(seance.charge);
    trace.length = 0;

    const production = seance.produirePlanche();
    const geste = seance.executer('echangerDansRetenu', { tour: 1, a: 1, b: 3 });
    const [second] = await Promise.all([production, geste]);
    assert.deepEqual(second, premier);
    assert.deepEqual(fs.octets('documents', second.nom), octetsPremiers);
    // Le PDF part d'abord, puis le geste écrit son entrée et son état.
    assert.deepEqual(trace[0], ['ecrireOctetsAtomique', premier.nom]);
    assert.deepEqual(trace[1], ['ajouterLigne', `${BASE}${SUFFIXES.journal}`]);
    assert.ok(trace.slice(1).every(([primitive]) => primitive !== 'ecrireOctetsAtomique'));

    const retouche = await seance.preparerPlanche();
    const horodatage = seance.charge.retenu.horodatage;
    assert.notEqual(horodatage, H_RETENU);
    assert.equal(retouche.nom, nomDe({ horodatage }));

    // Défaire rend la charge entière, horodatage compris : la production,
    // qui ne lit qu'elle et la demande, rend les octets que les deux
    // premières ont rendus à l'identique, sous le même nom.
    await seance.defaire();
    assert.deepEqual(seance.charge, chargePremiere);
    assert.equal((await seance.preparerPlanche()).nom, premier.nom);
  });

  test('une réédition de trois badges : un autre nom, « -3 », et la feuille de contrôle dit « Réédition : 3 badges » et nomme le caractère sans glyphe d’« Ondine 李 »', async () => {
    const charge = chargeLucioles();
    charge.participants[2].nom = '李';
    const { fs, seance, trace } = await monter(charge);
    // Une réédition de trois autres personnes, déjà posée sous le même nom :
    // la nouvelle prend le rang libre, et la première reste.
    const pris = nomDe({ reedition: { ids: [3, 1, 4] } });
    const anciens = new TextEncoder().encode('%PDF-réédition précédente');
    fs.deposerOctets('documents', pris, anciens);
    const annonce = await seance.preparerPlanche({ selection: [3, 1, 4] });
    const rendu = await seance.produirePlanche({ selection: [3, 1, 4] });
    assert.equal(rendu.nom, pris.replace(/\.pdf$/, '_2.pdf'));
    assert.equal(annonce.nom, rendu.nom);
    assert.match(rendu.nom, /\.badges-3_A4_feuille_/);
    assert.deepEqual(fs.octets('documents', pris), anciens);
    assert.deepEqual(trace, [['ecrireOctetsAtomique', rendu.nom]]);
    const pdf = await lirePdf(fs.octets('documents', rendu.nom));
    assert.ok(textesDe(pdf.pages[0]).includes(libelle('planche.controle.reedition', { n: 3 })), textesDe(pdf.pages[0]).join(' | '));
    assert.ok(textesDe(pdf.pages[0]).includes('Réédition : 3 badges'));
    const absents = libelle('planche.controle.absents', { points: ['U+674E'] });
    assert.ok(textesDe(pdf.pages[0]).includes(absents), textesDe(pdf.pages[0]).join(' | '));
    assert.equal(pdf.pages.length, 2);
  });

  test('deux propositions de la même génération, au même horodatage : deux fichiers ; la seconde porte le mot du filigrane au trait, sa feuille de contrôle aussi et la nomme ; en Lettre sous la demande par défaut, feuille par feuille, dans l’ordre alphabétique', async () => {
    const charge = chargeLucioles();
    assert.equal(charge.propositions[0].horodatage, charge.propositions[1].horodatage);
    const { fs, seance, trace } = await monter(charge, { papier: 'Lettre' });
    const premiere = await seance.produirePlanche({ source: 'proposition', proposition: 1 });
    const octetsPremiers = fs.octets('documents', premiere.nom);
    const rendu = await seance.produirePlanche({ source: 'proposition', proposition: 2 });
    assert.deepEqual(
      [premiere.nom, rendu.nom],
      [1, 2].map((proposition) => nomDe({ papier: 'Lettre', horodatage: H_PROPOSITION, proposition })),
    );
    assert.notEqual(premiere.nom, rendu.nom);
    assert.deepEqual(fs.octets('documents', premiere.nom), octetsPremiers);
    assert.notDeepEqual(fs.octets('documents', rendu.nom), octetsPremiers);
    const pdfs = (await fs.lister(DOC, '')).map(({ nom }) => nom).filter((nom) => nom.endsWith('.pdf'));
    assert.deepEqual(pdfs, [premiere.nom, rendu.nom]);
    assert.deepEqual(trace, [
      ['ecrireOctetsAtomique', premiere.nom],
      ['ecrireOctetsAtomique', rendu.nom],
    ]);

    // La seconde : le mot du filigrane au trait, sur ses planches et sa
    // feuille de contrôle, qui la nomme ; en Lettre sous la demande par
    // défaut, feuille par feuille, dans l'ordre alphabétique.
    const pdf = await lirePdf(fs.octets('documents', rendu.nom));
    const source = libelle('planche.controle.source', { source: 'proposition', proposition: 2 });
    assert.ok(textesDe(pdf.pages[0]).includes(source), textesDe(pdf.pages[0]).join(' | '));
    assert.ok(pdf.pages.every((page) => textesDe(page).includes(FILIGRANE)));
    assert.equal(auTrait(pdf), true);
    // Deux badges par planche : feuille par feuille, la planche p porte les
    // badges 2p − 1 et 2p de l'ordre alphabétique — en pile, ce seraient p
    // et p + 2 ; par table, la proposition 2 assied Ombrelle avec Grisaille.
    const sortie = { papier: 'Lettre', imposition: 'feuille', planches: 2 };
    assert.deepEqual(sortieLue(pdf, sortie), lignesDeSortie(sortie), textesDe(pdf.pages[0]).join(' | '));
    assert.deepEqual(
      pdf.pages.slice(1).map((page) => nomsParCellule(page, 'Lettre')),
      [
        ['Grisaille', 'Ondine Lacasse'],
        ['Iris Ombrelle', 'Théo Pervenche'],
      ],
    );
  });
});

describe('planche dans la séance : un nom par pile (§ 11.6)', () => {
  test('une réédition dont le dossier ne se liste pas : l’annonce garde le nom sans rang, produire se refuse PLANCHE_NON_ECRITE avant d’écrire, plutôt que de risquer un remplacement', async () => {
    const { fs, seance, trace } = await monter();
    const lister = fs.lister;
    fs.lister = async () => {
      throw new ErreurStockage('LECTURE', { chemin: '', dossier: DOCUMENTS, cause: 'EACCES' });
    };
    const nom = nomDe({ reedition: { ids: [2] } });
    assert.equal((await seance.preparerPlanche({ selection: [2] })).nom, nom);
    await refusee(seance.produirePlanche({ selection: [2] }), 'PLANCHE_NON_ECRITE', {
      chemin: nom,
      dossier: DOCUMENTS,
      cause: 'EACCES',
      remede: { geste: 'enregistrerSous' },
    });
    assert.deepEqual(trace, []);
    // Une planche entière ne liste pas le dossier : elle se nomme sans lui.
    assert.equal((await seance.preparerPlanche()).nom, nomDe());
    fs.lister = lister;
  });

  test('une planche entière dont la base se raccourcit liste le dossier : elle prend le premier rang libre plutôt que de remplacer un fichier ; un dossier qui ne se liste pas la refuse avant d’écrire', async () => {
    const nom = `Souper des Lucioles du printemps, \u{E9}dition sp\u{E9}ciale ${'et des Merles '.repeat(12)}`;
    const fs = creerFichiersSimules({ documents: DOCUMENTS });
    const { separateur } = await fs.emplacements();
    const base = deriverBase(nom, { racine: DOCUMENTS, separateur, existantes: [] });
    const { seance, trace } = await monter(chargeLucioles({ nom }), { papier: 'Lettre', fs, base });
    const demande = { source: 'proposition', proposition: 2, ordre: 'table' };
    const options = { papier: 'Lettre', imposition: 'feuille', horodatage: H_PROPOSITION, reedition: null, proposition: 2, ordre: 'table' };
    const raccourci = nomPlanche(base, { ...options, dossier: { racine: DOCUMENTS, separateur, existants: [] } });
    assert.notEqual(raccourci, nomPlanche(base, options), 'la base se raccourcit');
    assert.equal((await seance.preparerPlanche(demande)).nom, raccourci);
    // Le fichier d'un autre événement porte déjà ce nom : la planche prend le rang suivant.
    fs.deposer('documents', raccourci, 'planche d’un autre événement');
    const auRang2 = nomPlanche(base, { ...options, dossier: { racine: DOCUMENTS, separateur, existants: [raccourci] } });
    assert.ok(auRang2.endsWith('_2.pdf'), auRang2);
    assert.equal((await seance.preparerPlanche(demande)).nom, auRang2);
    const lister = fs.lister;
    fs.lister = async () => {
      throw new ErreurStockage('LECTURE', { chemin: '', dossier: DOCUMENTS, cause: 'EACCES' });
    };
    assert.equal((await seance.preparerPlanche(demande)).nom, nomPlanche(base, options));
    await refusee(seance.produirePlanche(demande), 'PLANCHE_NON_ECRITE', {
      chemin: nomPlanche(base, options),
      dossier: DOCUMENTS,
      cause: 'EACCES',
      remede: { geste: 'enregistrerSous' },
    });
    fs.lister = lister;
    assert.deepEqual(trace, []);
    assert.equal(fs.contenu('documents', raccourci), 'planche d’un autre événement');
  });
});

describe('planche dans la séance : l’écriture refusée, enregistrer sous, le web (§ 8.6, décision 13)', () => {
  test('un renommage refusé : PLANCHE_NON_ECRITE nomme le fichier, le dossier et la cause, offre « Enregistrer sous… », et le support de l’événement reste intact', async () => {
    const { fs, seance, trace } = await monter();
    fs.pannes.renommage('documents');
    const details = { chemin: nomDe(), dossier: DOCUMENTS, cause: 'EBUSY', remede: { geste: 'enregistrerSous' } };
    await refusee(seance.produirePlanche(), 'PLANCHE_NON_ECRITE', details);
    assert.equal(seance.supportRompu, false);
    assert.equal(fs.octets('documents', nomDe()), null);
    assert.deepEqual(trace, [['ecrireOctetsAtomique', nomDe()]]);
    assert.match(libelle('PLANCHE_NON_ECRITE', details), /Enregistrer sous/);
  });

  test('le support rompu : préparer passe, produire se refuse PLANCHE_NON_ECRITE sans toucher au refus du support, et enregistrerPlancheSous passe par le dialogue', async () => {
    const { fs, seance, trace } = await monter();
    await seance.passerEnEcriture();
    fs.pannes.ecriture('documents');
    await assert.rejects(seance.executer('echangerDansRetenu', { tour: 1, a: 1, b: 3 }));
    assert.equal(seance.supportRompu, true);
    const refusSupport = seance.refusSupport;
    trace.length = 0;

    assert.equal((await seance.preparerPlanche()).refus, null);
    await refusee(seance.produirePlanche(), 'PLANCHE_NON_ECRITE', {
      chemin: nomDe(),
      dossier: DOCUMENTS,
      cause: 'EROFS',
      remede: { geste: 'enregistrerSous' },
    });
    assert.deepEqual(seance.refusSupport, refusSupport);

    const recus = [];
    fs.enregistrerSous = async (nom, octets) => {
      recus.push([nom, octets]);
      return 'E:\\Copies\\planche.pdf';
    };
    assert.equal(await seance.enregistrerPlancheSous(), 'E:\\Copies\\planche.pdf');
    assert.deepEqual(recus.map(([nom]) => nom), [nomDe()]);
    assert.ok(recus[0][1] instanceof Uint8Array);
    assert.equal(new TextDecoder().decode(recus[0][1].subarray(0, 5)), '%PDF-');
    assert.deepEqual(trace.map(([primitive]) => primitive), ['ecrireOctetsAtomique']);
  });

  test('sous web, produire passe par enregistrerSous : le téléchargement, chemin null, rien dans le dossier ; en Lettre, en pile, par table, chaque nom à sa place', async () => {
    const fs = creerFichiersSimules({ documents: DOCUMENTS, nature: 'web' });
    const { seance, trace } = await monter(chargeLucioles(), { fs, papier: 'Lettre' });
    const recus = [];
    fs.enregistrerSous = async (nom, octets) => {
      recus.push([nom, octets]);
      return nom;
    };
    const attendu = nomDe({ papier: 'Lettre', imposition: 'pile', ordre: 'table' });
    const rendu = await seance.produirePlanche({ imposition: 'pile', ordre: 'table' });
    assert.deepEqual(rendu, { chemin: null, nom: attendu });
    assert.match(attendu, /_Lettre_pile_table_/);
    assert.deepEqual(trace, []);
    assert.equal(recus.length, 1);
    assert.equal(recus[0][0], attendu);
    assert.equal(fs.octets('documents', attendu), null);
    // Par table, le tour 1 donne Ombrelle, Pervenche (table 1), puis
    // Grisaille, Lacasse (table 2) ; en pile sur deux planches, la planche p
    // porte les badges p et p + 2 de cet ordre.
    const pdf = await lirePdf(recus[0][1]);
    assert.equal(pdf.pages.length, 3);
    const sortie = { papier: 'Lettre', imposition: 'pile', planches: 2 };
    assert.deepEqual(sortieLue(pdf, sortie), lignesDeSortie(sortie), textesDe(pdf.pages[0]).join(' | '));
    assert.deepEqual(
      pdf.pages.slice(1).map((page) => nomsParCellule(page, 'Lettre')),
      [
        ['Iris Ombrelle', 'Grisaille'],
        ['Théo Pervenche', 'Ondine Lacasse'],
      ],
    );
  });
});
