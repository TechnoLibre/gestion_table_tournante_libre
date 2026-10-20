// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle du profil trié de la page de qualité (§ 12.3, B12,
// B15, D28, D30, D41, D51) : deux graphiques au même ordre de rangs, celui
// du détail — le premier en comptes, deux séries, le plafond réalisé et la
// borne de diversité en repères, les rangs marqués ; le second en
// pourcentages, une série interrompue aux rangs sans plafond, la règle à
// 100 % ; l'infobulle et le jumeau portent la ligne entière, le
// pourcentage suivi du compte de la ligne ; une seule organisation ou
// aucune ne trace qu'une série, une seule table cède la place à sa phrase.
// Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { capacite, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { SIGNES, exigerColonnes, ligneInfobulle } from './graphiques/pointage.js';
import { graduerPourcent, profilDe } from './profil.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const outils = { t, format };
const V1 = VERSION.affichee;

// Six personnes inventées, deux tables de trois places, trois tours ;
// organisations : les deux premières à l'une, les deux suivantes à l'autre
// (deux), toutes à la même (une), aucune. tables : 2, ou 1 de six places.
function chargeSix({ organisations = 'deux', tables = 2, reservation = false } = {}) {
  const charge = creerCharge({ id: 'evt-profil', nom: 'Atelier Ressac', siegesParDefaut: tables === 1 ? 6 : 3, tours: 3 });
  const noms = [
    ['Ombrelle', 'Iris'],
    ['Pervenche', 'Théo'],
    ['Lacasse', 'Ondine'],
    ['Tourteau', 'Basile'],
    ['Quenouille', 'Maëlle'],
    ['Varech', 'Sidonie'],
  ];
  const organisationDe = (rang) => {
    if (organisations === 'une') return 'Coopérative Aubier';
    if (organisations === 'aucune' || rang >= 4) return null;
    return rang < 2 ? 'Coopérative Aubier' : 'Atelier Ressac';
  };
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation: organisationDe(rang),
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = Array.from({ length: tables }, (_, rang) => ({
    id: rang + 1,
    numero: rang + 1,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * (rang + 1), y: 0 },
  }));
  if (reservation) charge.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
  charge.prochainsIds = { participant: 7, table: tables + 1, proposition: 1 };
  return charge;
}

// Le détail de la première proposition d'une génération de la charge.
function detailDe(charge) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 3, nombre: 1, arret: 200 });
  const generee = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
  return detaillerQualite(generee, generee.propositions[0].id);
}

// Quatre personnes inventées, une table de trois places et une de deux,
// deux tours, et une proposition écrite à la main qui assied Maëlle
// Quenouille seule à la petite table aux deux tours : son plafond réalisé
// est nul. reservee : une réservation l'y ancre.
function chargeSeule({ reservee = false } = {}) {
  const charge = creerCharge({ id: 'evt-seule', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
  charge.participants = [
    ['Ombrelle', 'Iris'],
    ['Pervenche', 'Théo'],
    ['Lacasse', 'Ondine'],
    ['Quenouille', 'Maëlle'],
  ].map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation: rang < 2 ? 'Coopérative Aubier' : 'Atelier Ressac',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [
    { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 300, y: 0 } },
    { id: 2, numero: 2, sieges: 2, forme: 'ronde', position: { x: 600, y: 0 } },
  ];
  if (reservee) charge.reservations = [{ participant: 4, table: 2, siege: null, portee: 'tous', tour: null }];
  charge.prochainsIds = { participant: 5, table: 3, proposition: 2 };
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: V1,
      siegesAttribues: false,
      tables: [1, 2],
      capacites: charge.tables.map((table) => capacite(charge, table)),
      tours: 2,
      participants: [1, 2, 3, 4],
      placement: [0, 1].map(() => ({ sieges: [[1, 2, 3], [4]], reserve: [] })),
    },
  ];
  charge.evenement.etat = 'propose';
  return charge;
}

const nomDe = (detail, id) => detail.personnes.find((personne) => personne.id === id).nom;
const cles = (colonnes) => colonnes.map(({ cle }) => cle);

describe('profilDe : le premier graphique, en comptes (§ 12.3, B12, D30, D41)', () => {
  test('deux séries et deux repères, chacun une valeur par rang dans l’ordre du profil : rencontres, organisations, plafond réalisé, borne de diversité', () => {
    const detail = detailDe(chargeSix());
    const { comptes, cas, phrase } = profilDe(detail, outils);
    assert.equal(cas, 'profil');
    assert.equal(phrase, null);
    assert.deepEqual(comptes.series, [
      { libelle: t('qualite.profil.serie.rencontres'), valeurs: detail.profil.map(({ rencontres }) => rencontres) },
      { libelle: t('qualite.profil.serie.organisations'), valeurs: detail.profil.map(({ organisations }) => organisations) },
    ]);
    assert.deepEqual(comptes.reperes, [
      { genre: 'plafond', libelle: t('qualite.profil.repere.plafond'), valeurs: detail.profil.map(({ plafondRealise }) => plafondRealise) },
      { genre: 'borne', libelle: t('qualite.profil.repere.borne'), valeurs: detail.profil.map(({ borneDiversite }) => borneDiversite) },
    ]);
    // La borne se nomme « borne de diversité », jamais « plafond ».
    assert.equal(comptes.reperes[1].libelle, 'borne de diversité');
    assert.deepEqual(comptes.marques, detail.profil.map(({ marque }) => marque));
    assert.equal(comptes.synthese, t('qualite.profil.synthese', detail.synthese));
    assert.equal(comptes.nom, t('qualite.profil.graphique.comptes'));
  });

  test('l’ordre est celui du détail, jamais retrié : un profil forgé dans un autre ordre se trace tel quel, dans les deux graphiques', () => {
    const detail = structuredClone(detailDe(chargeSix()));
    detail.profil.reverse();
    detail.profil[0].pourcent = 99;
    detail.profil[1].pourcent = 3;
    const { comptes, pourcentages, infobulle } = profilDe(detail, outils);
    assert.deepEqual(comptes.series[0].valeurs, detail.profil.map(({ rencontres }) => rencontres));
    assert.deepEqual(pourcentages.series[0].valeurs, detail.profil.map(({ pourcent }) => pourcent));
    assert.deepEqual(infobulle.lignes.map(({ nom }) => nom), detail.profil.map(({ id }) => nomDe(detail, id)));
  });

  test('une personne réservée : le rang marqué « ancre », le signe à son rang', () => {
    const detail = detailDe(chargeSix({ reservation: true }));
    const { comptes } = profilDe(detail, outils);
    const rang = detail.profil.findIndex(({ id }) => id === 1);
    assert.equal(comptes.marques[rang], 'ancre');
  });
});

describe('profilDe : un plafond réalisé nul (§ 12.3, B12, D51)', () => {
  test('une personne mobile seule à sa table : la marque plafondNul, sans point au second graphique, son compte écrit ; ancrée, la marque ancre', () => {
    const detail = detaillerQualite(chargeSeule(), 1);
    assert.equal(detail.statut, 'comparable');
    const rang = detail.profil.findIndex(({ id }) => id === 4);
    assert.equal(detail.profil[rang].plafondRealise, 0);
    const { comptes, pourcentages, infobulle } = profilDe(detail, outils);
    assert.equal(comptes.marques[rang], 'plafondNul');
    assert.equal(pourcentages.series[0].valeurs[rang], null);
    assert.deepEqual(infobulle.lignes[rang].pourcent, { texte: null, compte: t('qualite.profil.ligne', { rencontres: 0, plafond: 0 }) });
    assert.equal(infobulle.lignes[rang].marque, t('qualite.profil.marque.plafondNul'));
    // Ancrée, la première marque qui s'applique.
    const ancree = detaillerQualite(chargeSeule({ reservee: true }), 1);
    const sonRang = ancree.profil.findIndex(({ id }) => id === 4);
    assert.equal(ancree.profil[sonRang].plafondRealise, 0);
    assert.equal(profilDe(ancree, outils).comptes.marques[sonRang], 'ancre');
  });
});

describe('profilDe : le second graphique, en pourcentages (§ 12.3, B12, D51)', () => {
  test('une seule série, le pourcentage du détail ; la règle à 100 % en repère, du motif du plafond, libellée « 100 % »', () => {
    const detail = detailDe(chargeSix());
    const { pourcentages } = profilDe(detail, outils);
    assert.deepEqual(pourcentages.series, [{ libelle: t('qualite.profil.serie.rencontres'), valeurs: detail.profil.map(({ pourcent }) => pourcent) }]);
    assert.deepEqual(pourcentages.reperes, [{ genre: 'cent', libelle: t('qualite.pourcentage.cent'), valeurs: detail.profil.map(() => 100) }]);
    assert.equal(pourcentages.nom, t('qualite.profil.graphique.pourcentages'));
    assert.notEqual(pourcentages.nom, profilDe(detail, outils).comptes.nom);
    // Sa synthèse : la personne au rang 1, son pourcentage, puis le pire en compte.
    const { rang1 } = detail.bornes;
    assert.deepEqual(pourcentages.synthese, {
      texte: t('qualite.profil.synthesePourcentage', { nom: nomDe(detail, rang1.id) }),
      pourcentage: { texte: t('qualite.pourcentage.valeur', { pourcent: rang1.pourcent }), compte: t('qualite.profil.pire', { rencontres: rang1.rencontres, plafond: rang1.plafondRealise }) },
    });
    assert.match(pourcentages.synthese.pourcentage.compte, /^minimum \d+ sur \d+$/);
  });

  test('les graduations de l’axe s’écrivent en pourcentages', () => {
    assert.equal(graduerPourcent(outils)(100), t('qualite.pourcentage.axe', { valeur: format.nombre(100) }));
    assert.equal(graduerPourcent(outils)(40), `40\u{202F}%`);
  });

  test('un rang au plafond réalisé nul n’a pas de point : sa valeur est null, et le compte de sa ligne reste écrit', () => {
    const detail = structuredClone(detailDe(chargeSix()));
    const ligne = detail.profil[2];
    Object.assign(ligne, { plafondRealise: 0, rencontres: 0, pourcent: null, marque: 'plafondNul' });
    const { pourcentages, comptes, infobulle } = profilDe(detail, outils);
    assert.equal(pourcentages.series[0].valeurs[2], null);
    assert.equal(comptes.marques[2], 'plafondNul');
    assert.deepEqual(infobulle.lignes[2].pourcent, { texte: null, compte: t('qualite.profil.ligne', { rencontres: 0, plafond: 0 }) });
  });

  test('la personne au rang 1 au plafond réalisé nul : la synthèse du second graphique le dit en entier, sans pourcentage', () => {
    const detail = detaillerQualite(chargeSeule(), 1);
    const { rang1 } = detail.bornes;
    assert.deepEqual([rang1.id, rang1.plafondRealise, rang1.pourcent], [4, 0, null]);
    const { synthese } = profilDe(detail, outils).pourcentages;
    assert.deepEqual(synthese, { texte: t('qualite.profil.plafondNul', { nom: nomDe(detail, 4) }), pourcentage: null });
    assert.equal(
      synthese.texte,
      'La personne au rang 1, Maëlle Quenouille, a un plafond réalisé nul : elle ne rencontre personne, et son rang n’a pas de point en pourcentage.',
    );
  });
});

describe('profilDe : l’infobulle et le jumeau portent la ligne entière (§ 12.3, B12, D34)', () => {
  test('une ligne par rang : rang, nom, organisation, rencontres, plafond réalisé, pourcentage et son compte, a priori, A(p), borne de diversité, tours non assis, marque', () => {
    const detail = detailDe(chargeSix({ reservation: true }));
    const { infobulle, tableaux } = profilDe(detail, outils);
    exigerColonnes(infobulle.colonnes);
    assert.deepEqual(cles(infobulle.colonnes), [
      'rang',
      'nom',
      'organisation',
      'rencontres',
      'plafondRealise',
      'pourcent',
      'plafondAPriori',
      'organisations',
      'borneDiversite',
      'toursNonAssis',
      'marque',
    ]);
    assert.equal(infobulle.colonnes.find(({ cle }) => cle === 'pourcent').genre, 'pourcentage');
    detail.profil.forEach((rang, i) => {
      const personne = detail.personnes.find(({ id }) => id === rang.id);
      assert.deepEqual(infobulle.lignes[i], {
        rang: i + 1,
        nom: personne.nom,
        organisation: personne.organisation,
        rencontres: rang.rencontres,
        plafondRealise: rang.plafondRealise,
        pourcent: {
          texte: rang.pourcent === null ? null : t('qualite.pourcentage.valeur', { pourcent: rang.pourcent }),
          compte: t('qualite.profil.ligne', { rencontres: rang.rencontres, plafond: rang.plafondRealise }),
        },
        plafondAPriori: rang.plafondAPriori,
        organisations: rang.organisations,
        borneDiversite: rang.borneDiversite,
        toursNonAssis: rang.toursNonAssis,
        marque: rang.marque === null ? null : t(`qualite.profil.marque.${rang.marque}`),
      });
    });
    // Chaque ligne s'écrit, son pourcentage suivi du compte « 24 sur 27 ».
    const ecrite = ligneInfobulle(infobulle.colonnes, infobulle.lignes[0], format.nombre);
    assert.match(ecrite.find(({ cle }) => cle === 'pourcent').compte, /^\d+ sur \d+$/);
    // Le jumeau : les mêmes lignes, puis la répartition des rencontres.
    assert.equal(tableaux.length, 2);
    assert.deepEqual(tableaux[0], { nom: t('qualite.vue.profil.titre'), colonnes: infobulle.colonnes, lignes: infobulle.lignes });
    assert.equal(tableaux[1].nom, t('qualite.profil.repartition.titre'));
    assert.deepEqual(cles(tableaux[1].colonnes), ['valeur', 'effectif', 'cumul', 'auPlafond']);
    assert.deepEqual(tableaux[1].lignes, detail.repartitionRencontres);
  });
});

describe('profilDe : les cas limites (§ 12.6, B15)', () => {
  // Une seule organisation : A(p) et la borne de diversité valent 1 et
  // restent écrites dans l'infobulle et le jumeau (B5) ; aucune : elles
  // valent 0 partout et leurs colonnes tombent avec le tracé.
  for (const [organisations, code, colonnesEcrites] of [
    ['une', 'uneOrganisation', true],
    ['aucune', 'aucuneOrganisation', false],
  ]) {
    test(`${code} : une seule série, ni borne de diversité tracée ; la phrase le dit ; les colonnes des organisations ${colonnesEcrites ? 'restent écrites' : 'tombent'}`, () => {
      const detail = detailDe(chargeSix({ organisations }));
      const { cas, phrase, comptes, infobulle, tableaux } = profilDe(detail, outils);
      assert.equal(cas, 'profil');
      assert.equal(phrase, code);
      assert.equal(comptes.series.length, 1);
      assert.deepEqual(comptes.reperes.map(({ genre }) => genre), ['plafond']);
      for (const colonnes of [infobulle.colonnes, tableaux[0].colonnes]) {
        assert.equal(cles(colonnes).includes('organisations'), colonnesEcrites);
        assert.equal(cles(colonnes).includes('borneDiversite'), colonnesEcrites);
      }
      if (colonnesEcrites) {
        // La phrase ne nie que le tracé : la colonne écrite ne la contredit
        // pas.
        assert.match(t(`qualite.profil.${code}`), /pas de borne de diversité tracée/);
        assert.deepEqual(infobulle.lignes.map(({ organisations: a }) => a), detail.profil.map(({ organisations: a }) => a));
        assert.deepEqual(infobulle.lignes.map(({ borneDiversite }) => borneDiversite), detail.profil.map(({ borneDiversite }) => borneDiversite));
      }
    });
  }

  test('une seule table : la phrase, pour les deux graphiques', () => {
    const detail = detailDe(chargeSix({ tables: 1 }));
    assert.deepEqual(profilDe(detail, outils), { cas: 'uneTable', phrase: 'uneTable' });
  });

  test('aucun profil sans détail comparable', () => {
    assert.equal(profilDe(null, outils), null);
    assert.equal(profilDe({ statut: 'fautif' }, outils), null);
  });
});

describe('profilDe : une personne absente à un tour (§ 12.3, § 12.6)', () => {
  test('son rang porte la marque « absente » dans les deux graphiques ; l’infobulle et le jumeau écrivent « absente à n tours »', () => {
    const charge = chargeSix();
    charge.participants[5].presence = [1, 2];
    const detail = detailDe(charge);
    const rang = detail.profil.findIndex(({ id }) => id === 6);
    assert.equal(detail.profil[rang].toursAbsents, 1);
    assert.equal(detail.profil[rang].marque, 'absente');
    const { comptes, pourcentages, infobulle, tableaux } = profilDe(detail, outils);
    assert.equal(comptes.marques[rang], 'absente');
    assert.equal(pourcentages.marques[rang], 'absente');
    // La colonne des absences suit les tours non assis, avant la marque.
    assert.deepEqual(cles(infobulle.colonnes).slice(-3), ['toursNonAssis', 'absences', 'marque']);
    const colonne = infobulle.colonnes.find(({ cle }) => cle === 'absences');
    assert.deepEqual(colonne, { cle: 'absences', libelle: t('qualite.profil.colonne.absences'), genre: 'texte' });
    assert.equal(infobulle.lignes[rang].absences, 'absente à 1 tour');
    assert.equal(infobulle.lignes[rang].marque, 'absente à un tour au moins');
    detail.profil.forEach((autre, i) => {
      if (i !== rang) assert.equal(infobulle.lignes[i].absences, null, `rang ${i + 1}`);
    });
    assert.deepEqual(tableaux[0].colonnes, infobulle.colonnes);
    // L'infobulle écrit la ligne entière, absences comprises.
    const ecrite = ligneInfobulle(infobulle.colonnes, infobulle.lignes[rang], format.nombre);
    assert.equal(ecrite.find(({ cle }) => cle === 'absences').texte, 'absente à 1 tour');
  });

  test('chaque signe a son libellé de légende, celui de la marque du profil ; l’absente se lit « absente à un tour au moins »', () => {
    for (const signe of SIGNES) assert.equal(t(`graphiques.signe.${signe}`), t(`qualite.profil.marque.${signe}`), signe);
    assert.equal(t('graphiques.signe.absente'), 'absente à un tour au moins');
  });

  test('les absences ne comptent que les tours d’absence, jamais les tours non assis : un profil forgé les fait suivre', () => {
    const charge = chargeSix();
    charge.participants[5].presence = [1, 2];
    const detail = structuredClone(detailDe(charge));
    const rang = detail.profil.findIndex(({ id }) => id === 6);
    Object.assign(detail.profil[rang], { toursNonAssis: 1, toursAbsents: 2, marque: 'reserve' });
    const { infobulle } = profilDe(detail, outils);
    assert.equal(infobulle.lignes[rang].absences, 'absente à 2 tours');
    assert.equal(infobulle.lignes[rang].toursNonAssis, 1);
    assert.equal(infobulle.lignes[rang].marque, t('qualite.profil.marque.reserve'));
  });

  test('le texte des absences s’accorde au nombre de tours', () => {
    assert.equal(t('qualite.profil.absences', { n: 1 }), 'absente à 1 tour');
    assert.equal(t('qualite.profil.absences', { n: 2 }), 'absente à 2 tours');
  });

  test('sans absence, la colonne des absences n’est pas écrite', () => {
    const { infobulle } = profilDe(detailDe(chargeSix()), outils);
    assert.equal(cles(infobulle.colonnes).includes('absences'), false);
  });
});
