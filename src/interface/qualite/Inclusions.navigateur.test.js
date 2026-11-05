// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les inclusions affichées dans un vrai moteur de rendu (§ 5.4, § 5.6,
// § 5.7, § 5.8, § 7.5, § 10.2, § 12.15) : la phrase sous le numéro d'une
// proposition, la liste de travail du plan et son clic, la vue
// « Inclusions » de la page de qualité, la rubrique « Inclusions du
// placement » de la fiche et l'information sous ses listes, la colonne du
// même nom de la grille, puis les énoncés du diagnostic et la carte de la
// proposition choisie. Chaque épreuve monte App par monterApp, au cadre de
// 1 366 × 700, sur un fichier d'état posé puis ouvert, et lit le rendu par
// le texte et les attributs data-…, jamais par une classe. Les noms
// d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { serialiser } from '../../stockage/canonique.js';
import { creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { cleDeRaison } from './inclusions.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;
const BASE = 'soiree';
const MERLES = 'Club des Merles';
const PINSONS = 'Cercle des Pinsons';
const HERONS = 'Cercle des Hérons';

// Sept personnes, deux tables de trois, deux tours ; la septième est exclue.
const SEPT = [
  ['Ombrelle', 'Iris', MERLES],
  ['Fontaine', 'Noé', MERLES],
  ['Pervenche', 'Théo', PINSONS],
  ['Lacasse', 'Ondine', PINSONS],
  ['Grisaille', null, null],
  ['Bruyère', 'Anouk', null],
  ['Sarcelle', 'Capucine', PINSONS],
];

// Proposition 1 : Iris et Anouk ne se rencontrent jamais, Grisaille et Noé
// non plus. Proposition 2 : chaque rencontre demandée se fait.
const PLANS = [
  [
    [[1, 2, 3], [4, 5, 6]],
    [[1, 4, 5], [2, 3, 6]],
  ],
  [
    [[1, 2, 6], [3, 4, 5]],
    [[2, 3, 5], [1, 4, 6]],
  ],
];

// Iris et Anouk se demandent l'une l'autre ; Noé inclut les Pinsons, que
// Théo lui fait rencontrer ; Grisaille inclut Noé ; Théo inclut Capucine,
// exclue ; Ondine inclut les cinq autres présentes, plus qu'elle n'en peut
// rencontrer en deux tours.
function chargeSept() {
  const charge = creerCharge({ id: 'evt-inclusions', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
  charge.participants = SEPT.map(([nom, prenom, organisation], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: rang === 6,
  }));
  const inclusions = new Map([
    [1, { inclusionsParticipant: [6] }],
    [2, { inclusionsOrganisation: [PINSONS] }],
    [3, { inclusionsParticipant: [7] }],
    [4, { inclusionsParticipant: [1, 2, 3, 5, 6] }],
    [5, { inclusionsParticipant: [2] }],
    [6, { inclusionsParticipant: [1] }],
  ]);
  for (const personne of charge.participants) Object.assign(personne, inclusions.get(personne.id) ?? {});
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.propositions = PLANS.map((tours, rang) => ({
    id: rang + 1,
    graine: rang + 1,
    arret: 40,
    historique: 1000,
    produitVersion: V1,
    siegesAttribues: false,
    tables: [1, 2],
    capacites: [3, 3],
    tours: tours.length,
    participants: [1, 2, 3, 4, 5, 6],
    placement: tours.map((listes) => ({ sieges: structuredClone(listes), reserve: [] })),
  }));
  charge.prochainsIds = { participant: 8, table: 3, proposition: 3 };
  charge.evenement.etat = 'propose';
  return charge;
}

let montes = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await dessinerGraphiques(document.body);
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// La charge ouverte en lecture, la proposition montrer demandée au plan, la
// section donnée ouverte.
async function ouvrir(section, { montrer = 1, charge = chargeSept() } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}/${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(`${BASE}/${BASE}`);
  if (montrer !== null) m.ui.montrerProposition(montrer);
  m.ui.allerA(section);
  flushSync();
  return m;
}

const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const textes = (racine, selecteur) => [...racine.querySelectorAll(selecteur)].map(texteDe);

const AVIS_IRIS = "Iris Ombrelle n'a pas rencontré Anouk Bruyère, une rencontre demandée des deux côtés";
const AVIS_GRISAILLE = "Grisaille n'a pas rencontré Noé Fontaine";

describe('la phrase sous le numéro et la liste de travail du plan (§ 5.7, § 5.8)', () => {
  test('« 2 inclusions non satisfaites » sous le numéro de la proposition 1 ; rien sous la 2, qui les fait toutes', async () => {
    const m = await ouvrir('propositions');
    const phrase = await attendre(() => {
      const trouvee = dans(m, '[data-section="propositions"] [data-proposition="1"] [data-inclusions-non-satisfaites]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(texteDe(phrase)).toBe('2 inclusions non satisfaites');
    expect(dans(m, '[data-section="propositions"] [data-proposition="2"] [data-inclusions-non-satisfaites]')).toBeNull();
  });

  test('chaque avis du placement montré, dans l’ordre de la mesure ; un clic choisit la personne qui le porte, un second l’oublie ; « Aucune. » sous la 2', async () => {
    const m = await ouvrir('plan');
    const liste = await attendre(() => {
      const trouvee = dans(m, '[data-liste-travail="inclusions"]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(texteDe(dans(m, `#${liste.getAttribute('aria-labelledby')}`))).toBe(t('plan.listesTravail.inclusions'));
    expect(textes(liste, 'button')).toEqual([AVIS_IRIS, AVIS_GRISAILLE]);
    // Chaque nom dans son propre nœud.
    expect(textes(liste.querySelector('button'), 'span')).toEqual([
      'Iris Ombrelle',
      "n'a pas rencontré",
      'Anouk Bruyère',
      ', une rencontre demandée des deux côtés',
    ]);
    const bouton = liste.querySelector('[data-participant="5"]');
    bouton.click();
    await attendre(() => expect(bouton.getAttribute('aria-pressed')).toBe('true'));
    expect(m.ui.etat().choix).toEqual({ genre: 'personne', participant: 5, depuis: null });
    bouton.click();
    await attendre(() => expect(bouton.getAttribute('aria-pressed')).toBe('false'));
    expect(m.ui.etat().choix).toBeNull();

    m.ui.montrerProposition(2);
    await attendre(() => expect(dans(m, '[data-liste-travail="inclusions"]').querySelectorAll('button')).toHaveLength(0));
    expect(texteDe(dans(m, '[data-liste-travail="inclusions"]').nextElementSibling)).toBe(t('plan.listesTravail.aucuneInclusion'));
  });

  test('sans inclusion active, ni phrase ni liste', async () => {
    const charge = chargeSept();
    for (const personne of charge.participants) {
      delete personne.inclusionsParticipant;
      delete personne.inclusionsOrganisation;
    }
    const m = await ouvrir('plan', { charge });
    await attendre(() => expect(dans(m, '[data-liste-travail="pressentis"]')).not.toBeNull());
    expect(dans(m, '[data-liste-travail="inclusions"]')).toBeNull();
  });
});

describe('la vue « Inclusions » de la page de qualité (§ 12.15)', () => {
  test('la synthèse, les avis en tête, puis la liste au-delà du plafond et l’inclusion hors d’atteinte', async () => {
    const m = await ouvrir('qualite');
    const vue = await attendre(() => {
      const trouvee = dans(m, '[data-vue-qualite="inclusions"]');
      expect(trouvee?.querySelector('[data-liste-inclusions="avis"]')).not.toBeNull();
      return trouvee;
    });
    expect(texteDe(vue.querySelector('h3'))).toBe(t('qualite.vue.inclusions.titre'));
    expect(texteDe(vue.querySelector('[data-phrase-qualite="inclusions.synthese"]'))).toBe('2 inclusions non satisfaites sur 3 rencontres demandées.');
    expect(textes(vue, '[data-liste-inclusions="avis"] li')).toEqual([AVIS_IRIS, AVIS_GRISAILLE]);
    expect(textes(vue, '[data-liste-inclusions="auDela"] li')).toEqual([
      'Ondine Lacasse : 3 inclusions satisfaites sur 5, au plus 4 possibles ; 1 inclusion encore possible non atteinte',
    ]);
    expect(textes(vue, '[data-liste-inclusions="horsDAtteinte"] li')).toEqual([
      'Théo Pervenche \u{2192} Capucine Sarcelle : la personne incluse est exclue',
    ]);
    // Les avis viennent avant les deux informations.
    const avis = vue.querySelector('[data-liste-inclusions="avis"]');
    expect(avis.compareDocumentPosition(vue.querySelector('[data-liste-inclusions="auDela"]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Chaque liste porte le nom de son intertitre.
    const nomDeListe = (genre) => texteDe(dans(m, `#${vue.querySelector(`[data-liste-inclusions="${genre}"]`).getAttribute('aria-labelledby')}`));
    expect(['avis', 'auDela', 'horsDAtteinte'].map(nomDeListe)).toEqual([
      t('qualite.inclusions.nonSatisfaites'),
      t('qualite.inclusions.auDela'),
      t('qualite.inclusions.horsDAtteinte'),
    ]);
  });

  test('des inclusions toutes hors d’atteinte : la phrase le dit, et la liste hors d’atteinte la suit', async () => {
    const charge = chargeSept();
    for (const personne of charge.participants) {
      if (personne.id === 3) continue;
      delete personne.inclusionsParticipant;
      delete personne.inclusionsOrganisation;
    }
    const m = await ouvrir('qualite', { charge });
    const vue = await attendre(() => {
      const trouvee = dans(m, '[data-vue-qualite="inclusions"]');
      expect(trouvee?.querySelector('[data-phrase-qualite="inclusions.aucun.horsDAtteinte"]')).not.toBeNull();
      return trouvee;
    });
    expect(texteDe(vue.querySelector('[data-phrase-qualite="inclusions.aucun.horsDAtteinte"]'))).toBe(t('qualite.inclusions.aucun.horsDAtteinte'));
    expect(textes(vue, '[data-liste-inclusions="horsDAtteinte"] li')).toEqual([
      'Théo Pervenche \u{2192} Capucine Sarcelle : la personne incluse est exclue',
    ]);
    expect(vue.querySelector('[data-liste-inclusions="avis"]')).toBeNull();
  });

  test('sans inclusion active, la vue cède la place à sa phrase', async () => {
    const charge = chargeSept();
    for (const personne of charge.participants) {
      delete personne.inclusionsParticipant;
      delete personne.inclusionsOrganisation;
    }
    const m = await ouvrir('qualite', { charge });
    const phrase = await attendre(() => {
      const trouvee = dans(m, '[data-vue-qualite="inclusions"] [data-phrase-qualite="inclusions.aucun"]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(texteDe(phrase)).toBe(t('qualite.inclusions.aucun'));
  });
});

describe('la fiche et la grille des participants (§ 7.5, § 10.2)', () => {
  async function ficheDe(m, personne) {
    m.ui.ouvrirFiche(personne);
    return attendre(() => {
      const trouvee = dans(m, `[data-fiche="${personne}"]`);
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
  }
  const rubrique = (fiche) => fiche.querySelector('[data-rubrique-inclusions-placement]');

  test('la rubrique « Inclusions du placement » : la ligne de source, les comptes, chaque avis qui nomme la personne, la liste au-delà du plafond', async () => {
    const m = await ouvrir('participants');
    const anouk = rubrique(await ficheDe(m, 6));
    expect(texteDe(anouk.querySelector('h4'))).toBe(t('participants.fiche.inclusionsPlacement.titre'));
    expect(texteDe(anouk.querySelector('.source'))).toBe(
      `${t('participants.fiche.rencontres.intitule')} ${t('participants.fiche.rencontres.proposition', { proposition: 1 })}`,
    );
    expect(texteDe(anouk.querySelector('[data-inclusions-compte]'))).toBe('0 inclusion satisfaite sur 1.');
    expect(textes(anouk, 'li')).toEqual([AVIS_IRIS]);
    // Noé n'inclut aucune personne : l'avis de Grisaille le nomme.
    const noe = rubrique(await ficheDe(m, 2));
    expect(texteDe(noe.querySelector('[data-inclusions-compte]'))).toBe('1 inclusion satisfaite sur 1.');
    expect(textes(noe, 'li')).toEqual([AVIS_GRISAILLE]);
    const ondine = rubrique(await ficheDe(m, 4));
    expect(texteDe(ondine.querySelector('[data-inclusions-au-dela]'))).toBe(
      "Sa liste dépasse ce qu'elle peut rencontrer : 4 de ses inclusions au plus peuvent être satisfaites, et 1 inclusion encore " +
        "possible n'est pas atteinte. Ce n'est pas un avis.",
    );
    expect(ondine.querySelector('li')).toBeNull();
    // Rencontrée par personne et n'incluant personne d'actif : la phrase.
    const theo = rubrique(await ficheDe(m, 3));
    expect(texteDe(theo)).toContain(t('participants.fiche.inclusionsPlacement.aucune'));
    // Placée avant les rencontres.
    const rencontres = dans(m, '[data-fiche="3"] [data-rubrique-rencontres]');
    expect(theo.compareDocumentPosition(rencontres) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('sous la liste des personnes incluses, l’inclusion hors d’atteinte et sa raison ; aucune sous l’autre liste', async () => {
    const m = await ouvrir('participants');
    const fiche = await ficheDe(m, 3);
    const participant = fiche.querySelector('[data-inclusions-fiche="participant"]');
    const information = participant.querySelector('[data-inclusions-hors-atteinte]');
    expect(information).not.toBeNull();
    expect(textes(information, 'li')).toEqual([`Capucine Sarcelle : ${t(cleDeRaison('exclue'))}`]);
    expect(fiche.querySelector('[data-inclusions-fiche="organisation"] [data-inclusions-hors-atteinte]')).toBeNull();
  });

  test('sans placement : ni rubrique, l’information sous la liste restant', async () => {
    const charge = chargeSept();
    charge.propositions = [];
    charge.evenement.etat = 'brouillon';
    const m = await ouvrir('participants', { charge, montrer: null });
    const fiche = await ficheDe(m, 3);
    expect(rubrique(fiche)).toBeNull();
    expect(fiche.querySelector('[data-inclusions-hors-atteinte]')).not.toBeNull();
  });

  test('la colonne « Inclusions du placement », montrée avec celle des inclusions : les comptes, puis l’autre partie de chaque avis', async () => {
    const m = await ouvrir('participants');
    const section = await attendre(() => {
      const trouvee = dans(m, '[data-section="participants"]');
      expect(trouvee?.querySelector('[role="grid"]')).not.toBeNull();
      return trouvee;
    });
    expect(section.querySelector('[data-champ="inclusionsPlacement"]')).toBeNull();
    section.querySelector('[data-champ="montrerInclusions"]').click();
    const cellule = (id) => section.querySelector(`[role="grid"] [data-participant="${id}"] [data-champ="inclusionsPlacement"]`);
    await attendre(() => expect(cellule(1)).not.toBeNull());
    expect(textes(cellule(1), 'li')).toEqual(['0 sur 1', 'sans Anouk Bruyère']);
    expect(textes(cellule(2), 'li')).toEqual(['1 sur 1', 'sans Grisaille']);
    expect(textes(cellule(4), 'li')).toEqual(['3 sur 5', t('participants.inclusionsPlacement.auDela')]);
    expect(cellule(3).querySelector('[data-inclusions-placement]')).toBeNull();
    expect(texteDe(cellule(3))).toBe('\u{2014}');
  });

  test('une rencontre demandée des deux côtés, portée par la ligne d’organisation de l’une : l’avis paraît chez les deux, fiche et grille', async () => {
    // Anouk, seule aux Hérons ; Iris inclut les Hérons, Anouk inclut Iris,
    // et la proposition 1 ne les réunit jamais.
    const charge = chargeSept();
    const [iris, anouk] = [1, 6].map((id) => charge.participants.find((personne) => personne.id === id));
    anouk.organisation = HERONS;
    delete iris.inclusionsParticipant;
    iris.inclusionsOrganisation = [HERONS];
    const m = await ouvrir('participants', { charge });
    const avis = `Iris Ombrelle n'a rencontré personne de ${HERONS}, une rencontre demandée des deux côtés`;
    const deAnouk = rubrique(await ficheDe(m, 6));
    expect(texteDe(deAnouk.querySelector('[data-inclusions-compte]'))).toBe('0 inclusion satisfaite sur 1.');
    expect(textes(deAnouk, 'li')).toEqual([avis]);
    expect(textes(rubrique(await ficheDe(m, 1)), 'li')).toEqual([avis]);
    const section = dans(m, '[data-section="participants"]');
    section.querySelector('[data-champ="montrerInclusions"]').click();
    const cellule = (id) => section.querySelector(`[role="grid"] [data-participant="${id}"] [data-champ="inclusionsPlacement"]`);
    await attendre(() => expect(cellule(6)).not.toBeNull());
    expect(textes(cellule(6), 'li')).toEqual(['0 sur 1', 'sans Iris Ombrelle']);
    expect(textes(cellule(1), 'li')).toEqual(['0 sur 1', `sans ${HERONS}`]);
  });
});

describe('le diagnostic (§ 5.6)', () => {
  test('la carte des inclusions : l’inclusion hors d’atteinte, puis la liste au-delà du plafond ; la proposition choisie compte les avis et les inclusions encore possibles', async () => {
    const m = await ouvrir('diagnostic');
    const enonces = await attendre(() => {
      const trouves = textes(m.racine, '[data-section="diagnostic"] [data-enonce^="diagnostic.inclusion"] [data-phrase]');
      expect(trouves).toHaveLength(2);
      return trouves;
    });
    expect(enonces).toEqual([
      "inclusion hors d'atteinte : Théo Pervenche \u{2192} Capucine Sarcelle, la personne incluse est exclue",
      'Ondine Lacasse : 5 inclusions demandent 5 personnes ; la soirée lui en fait rencontrer au plus 4, donc au plus 4 satisfaites, ' +
        'et 1 reste hors de portée',
    ]);
    const atteint = textes(m.racine, '[data-proposition-choisie] [data-bloc-proposition="atteint"] p');
    expect(atteint).toContain('2 rencontres demandées par les inclusions sur 3 ne se font pas : ce sont les inclusions non satisfaites.');
    expect(atteint).toContain(
      "Une personne a une liste d'inclusions qui dépasse ce qu'elle peut rencontrer : 1 inclusion encore possible n'est pas atteinte, " +
        'sans que ce soit un avis.',
    );
  });
});
