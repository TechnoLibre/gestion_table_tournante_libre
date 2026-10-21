// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les réglages de génération montrés depuis leur définition, dans un vrai
// moteur de rendu (§ 5.3, § 5.7, § 19.8) : Reglages.svelte, monté par mount
// avec les contextes que pose App — 't', 'seance', 'generation' —, sur une
// séance du système de fichiers simulé et l'horloge pilotée, montre chaque
// entrée de la section 'generation' de REGLAGES_GENERATION dans son ordre,
// sous son libellé, à la valeur de la charge, et aucune d'une autre section ;
// une définition passée par l'épreuve, une entrée ajoutée ou retirée, change
// l'écran de même.
//
// L'éditeur de l'ordre des priorités et le choix du mode des objectifs
// (§ 5.3, § 5.7, A8, A11, A12, D23) s'éprouvent dans l'application montée
// sur la petite démonstration, la section de la génération ouverte : chaque
// geste, au pointeur réel ou au clavier, est une commande et une entrée ; les
// gestes offerts sont ceux du modèle sous l'admission de la commande ; un
// refus se pose contre la liste ou contre le groupe, et le choix refusé
// revient à l'ancien mode. Le texte attendu vient de la même traduction que
// celle de l'application ; les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import '../jetons.css';
import { creerControleurGeneration, creerExecuteurDirect } from '../../application/generation.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerSeance } from '../../application/seance.js';
import { creerTraduction } from '../../application/traduction.js';
import { CRITERES, MODES_OBJECTIFS } from '../../moteur/criteres.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { creerFichiersSimules } from '../../../test/fichiers_simules.js';
import { couleurDeJeton, releverTextes } from '../../../test/navigateur/captures.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { composantes, sousTheme } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Reglages from './Reglages.svelte';
import { LISTE_PAR_DEFAUT, admissionSous, etatAffiche, etatsDesCriteres, gestesOfferts, listeApres } from './priorites.js';
import { REGLAGES_GENERATION, reglagesDeSection } from './reglages.js';

// Les entrées que l'écran de la génération montre : celles de sa section.
const DE_LA_GENERATION = reglagesDeSection(REGLAGES_GENERATION, 'generation');

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Les composants montés par l'épreuve courante, et leurs conteneurs.
const montes = [];
afterEach(() => {
  for (const { composant, cible } of montes.splice(0)) {
    unmount(composant);
    cible.remove();
  }
});

// Une séance sur le système simulé et l'horloge pilotée, un événement créé,
// son contrôleur de génération ; Reglages monté sur la charge que rend
// avecCharge(charge de la séance), avec les props supplémentaires. Rend le
// conteneur.
async function monter({ avecCharge = (charge) => charge, props = {} } = {}) {
  const fs = creerFichiersSimules();
  fs.deposerDossier('documents');
  const { documents } = await fs.racines();
  const horloge = creerHorlogePilotee();
  let tirages = 0;
  const seance = creerSeance({
    fs,
    racine: documents,
    horloge,
    identifiant: () => {
      tirages += 1;
      return `epreuve-${tirages}`;
    },
    produitVersion: VERSION.affichee,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
  });
  await seance.creer({ nom: 'Soirée des Merles', date: null, siegesParDefaut: 6, tours: 2 });
  const generation = creerControleurGeneration({
    seance,
    executeur: creerExecuteurDirect({ coeursDisponibles: 4 }),
    horloge,
    produitVersion: VERSION.affichee,
  });
  const cible = document.createElement('div');
  document.body.append(cible);
  const composant = mount(Reglages, {
    target: cible,
    props: {
      charge: avecCharge(seance.etat().charge),
      mesure: null,
      estimation: null,
      graine: '7',
      refusGraine: null,
      saisirGraine: () => {},
      ...props,
    },
    context: new Map([
      ['t', t],
      ['seance', seance],
      ['generation', generation],
    ]),
  });
  flushSync();
  montes.push({ composant, cible });
  return cible;
}

// Les désignations des champs montrés, dans l'ordre du document.
const designations = (cible) => [...cible.querySelectorAll('input[data-champ]')].map((entree) => entree.dataset.champ);

// Les désignations qu'une définition montre, dans l'ordre du document : les
// champs, puis chaque bascule suivie des boutons radio des choix qui se
// montrent sous elle ; l'ordre des priorités, à son défaut, n'a aucun champ.
function designationsAttendues(definition) {
  const generation = reglagesDeSection(definition, 'generation');
  const sous = (cle) => generation.filter((e) => e.genre === 'choix' && e.sous === cle).flatMap((e) => e.valeurs.map(() => e.cle));
  return [
    ...generation.filter(({ genre }) => genre === 'champ').map(({ cle }) => cle),
    ...generation.filter(({ genre }) => genre === 'bascule').flatMap(({ cle }) => [cle, ...sous(cle)]),
  ];
}

// L'entrée désignée par sa clé, et le texte de son libellé.
const entree = (cible, cle) => cible.querySelector(`input[data-champ="${cle}"]`);
const libelleDe = (cible, cle) => cible.querySelector(`label[for="${entree(cible, cle).id}"]`).textContent.trim();

describe('Reglages : l’écran montre la définition (§ 19.8)', () => {
  test('la définition livrée : la graine, chaque entrée de la génération dans son ordre, sous son libellé, à la valeur de la charge, puis les cœurs ; aucune cible de redondance', async () => {
    const cible = await monter();
    expect(DE_LA_GENERATION.length).toBeGreaterThan(0);
    expect(DE_LA_GENERATION.length).toBe(REGLAGES_GENERATION.length);
    expect(designations(cible)).toEqual(['graine', ...designationsAttendues(REGLAGES_GENERATION), 'coeursAutomatiques']);
    expect(cible.querySelector('[data-champ="cibleRedondance"]')).toBeNull();
    for (const { cle, etiquette, genre, defaut, valeurs } of DE_LA_GENERATION) {
      if (genre === 'choix') {
        const groupe = cible.querySelector('[data-mode-objectifs]');
        expect(groupe.querySelector('legend').textContent.trim(), cle).toBe(t(etiquette));
        const radios = [...groupe.querySelectorAll(`input[type="radio"][data-champ="${cle}"]`)];
        expect(radios.map((r) => r.value)).toEqual([...valeurs]);
        for (const radio of radios) {
          expect(cible.querySelector(`label[for="${radio.id}"]`).textContent.trim()).toBe(t(`${etiquette}.${radio.value}`));
          expect(radio.checked, radio.value).toBe(radio.value === defaut);
        }
        continue;
      }
      if (genre === 'ordre') {
        const liste = cible.querySelector('[data-priorites]');
        expect(liste.closest('fieldset').querySelector('legend').textContent.trim()).toBe(t(etiquette));
        expect(liste.querySelectorAll('[data-palier]')).toHaveLength(defaut.length);
        continue;
      }
      expect(libelleDe(cible, cle), cle).toBe(t(etiquette));
      // Une charge neuve porte les défauts de la définition.
      if (genre === 'bascule') expect(entree(cible, cle).checked, cle).toBe(defaut);
      else expect(entree(cible, cle).value, cle).toBe(String(defaut));
    }
  });

  test('une entrée ajoutée à la définition paraît à l’écran, champ comme bascule, à sa place, sous son libellé, à la valeur de la charge', async () => {
    const champ = Object.freeze({
      nom: 'epreuve',
      cle: 'generation.epreuve',
      etiquette: 'generation.coeurs.titre',
      unite: 'mouvements',
      defaut: 1,
      genre: 'champ',
      section: 'generation',
    });
    const bascule = Object.freeze({
      nom: 'epreuveBascule',
      cle: 'epreuveBascule',
      etiquette: 'generation.contraintes.titre',
      unite: null,
      defaut: false,
      genre: 'bascule',
      section: 'generation',
    });
    // Une entrée d'une autre section ne paraît pas sur cet écran.
    const ailleurs = Object.freeze({ ...champ, nom: 'ailleurs', cle: 'ailleurs', section: 'propositions' });
    const definition = [...DE_LA_GENERATION.slice(0, 1), champ, ailleurs, ...DE_LA_GENERATION.slice(1), bascule];
    const cible = await monter({
      avecCharge: (charge) => ({
        ...charge,
        reglages: { ...charge.reglages, epreuveBascule: true, generation: { ...charge.reglages.generation, epreuve: 4321 } },
      }),
      props: { definition },
    });
    const [premier, ...autres] = designationsAttendues(REGLAGES_GENERATION);
    expect(designations(cible)).toEqual(['graine', premier, 'generation.epreuve', ...autres, 'epreuveBascule', 'coeursAutomatiques']);
    expect(libelleDe(cible, 'generation.epreuve')).toBe(t('generation.coeurs.titre'));
    expect(entree(cible, 'generation.epreuve').value).toBe('4321');
    expect(libelleDe(cible, 'epreuveBascule')).toBe(t('generation.contraintes.titre'));
    expect(entree(cible, 'epreuveBascule').type).toBe('checkbox');
    expect(entree(cible, 'epreuveBascule').checked).toBe(true);
  });

  test('une entrée retirée de la définition quitte l’écran : seuls ses champs et ses bascules paraissent', async () => {
    const gardees = DE_LA_GENERATION.filter(({ nom }) => nom === 'arret' || nom === 'nouvelleTable');
    expect(gardees).toHaveLength(2);
    const cible = await monter({ props: { definition: gardees } });
    expect(designations(cible)).toEqual(['graine', 'generation.arret', 'nouvelleTable', 'coeursAutomatiques']);
  });
});

describe('l’habillage des réglages', () => {
  test('chaque champ de saisie sur le fond de la carte, au filet de contrôle, dans les deux thèmes ; chaque groupe sous un intertitre en petites capitales', async () => {
    const cible = await monter();
    const champs = [...cible.querySelectorAll('input[type="text"]')];
    expect(champs.length).toBeGreaterThan(0);
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        for (const champ of champs) {
          const style = getComputedStyle(champ);
          expect(composantes(style.backgroundColor).join(), `${theme} ${champ.dataset.champ}`).toBe(couleurDeJeton('--couleur-carte-fond').join());
          expect(composantes(style.borderTopColor).join(), `${theme} ${champ.dataset.champ}`).toBe(couleurDeJeton('--couleur-page-filet').join());
        }
      });
    }
    // Les contraintes, l'ordre des priorités et les cœurs : trois groupes ;
    // le choix du mode, sous sa case, se lit comme le libellé d'un champ.
    const legendes = [...cible.querySelectorAll('fieldset:not([data-mode-objectifs]) > legend')];
    expect(legendes.length).toBe(3);
    for (const legende of legendes) expect(getComputedStyle(legende).textTransform).toBe('uppercase');
    expect(getComputedStyle(cible.querySelector('[data-mode-objectifs] > legend')).textTransform).toBe('none');
  });
});

// --- L'éditeur des priorités et le choix du mode, dans l'application ----------

const [ECART, EXCEDENT, CUMULEES, HORS_OBJECTIF, REPETEES, ANIMATEURS, REDONDANCE, CONFLITS] = CRITERES;

// Les montages de l'application, démontés après l'épreuve ; le collecteur
// d'erreurs n'a rien reçu pendant elle.
const applications = [];
afterEach(() => {
  const erreurs = applications.flatMap((m) => m.erreurs());
  for (const m of applications.splice(0).reverse()) m.demonter();
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// L'application sur la petite démonstration, en écriture sauf ecriture
// faux, la section de la génération ouverte.
async function demonstration({ ecriture = true } = {}) {
  await fixerCadre(1366, 700);
  const m = await monterApp({ executeur: creerExecuteurDirect() });
  applications.push(m);
  await m.facade.chargerDemonstration('petite');
  if (ecriture) await m.seance.passerEnEcriture();
  m.ui.allerA('generation');
  flushSync();
  return m;
}

const section = (m) => m.racine.querySelector('[data-section="generation"]');
const liste = (m) => section(m).querySelector('[data-priorites]');
const editeur = (m) => liste(m).closest('fieldset');
const critereDe = (m, nom) => liste(m).querySelector(`[data-priorite="${nom}"]`);
const bouton = (m, nom, geste) => critereDe(m, nom)?.querySelector(`[data-commande="${geste}"]`) ?? null;
const offerts = (m, nom) => [...critereDe(m, nom).querySelectorAll('button[data-commande]')].map((b) => b.dataset.commande);
const annonce = (m) => editeur(m).querySelector(':scope > [role="status"]').textContent.trim();
const groupe = (m) => section(m).querySelector('[data-mode-objectifs]');
const radio = (m, valeur) => groupe(m).querySelector(`input[type="radio"][value="${valeur}"]`);
const charge = (m) => m.seance.etat().charge;
const revision = (m) => m.seance.etat().evenement.revision;
const journal = (m) => {
  const { base } = m.seance.etat().evenement;
  return lireJournal(m.fs.contenu('documents', `${base}${SUFFIXES.journal}`)).entrees.length;
};
const ordreDe = (m) => charge(m).reglages.priorites ?? structuredClone(LISTE_PAR_DEFAUT);

// Laisse passer une image, la file de la séance passée, puis le rendu.
async function passer(m) {
  await m.seance.formeNommee(null).catch(() => undefined);
  await new Promise((resoudre) => requestAnimationFrame(resoudre));
  flushSync();
}

// Un clic réel au centre de l'élément, puis la file de la séance passée.
async function cliquer(m, element) {
  expect(element, 'élément à cliquer').not.toBeNull();
  element.scrollIntoView({ block: 'center' });
  const { left, top, width, height } = element.getBoundingClientRect();
  await pointer('presser', left + width / 2, top + height / 2);
  await pointer('relacher', left + width / 2, top + height / 2);
  await passer(m);
}

// Une touche sur l'élément qui a le focus, puis la file passée.
async function presser(m, cle) {
  await touche(cle);
  await passer(m);
}

describe('l’ordre des priorités : l’éditeur (§ 5.7, A11, A12)', () => {
  test('au défaut : une liste ordonnée de huit paliers numérotés en texte, chaque critère sous son nom complet, son état lu dans la table d’évaluation, aucun poids', async () => {
    const m = await demonstration();
    expect(liste(m).tagName).toBe('OL');
    const paliers = [...liste(m).querySelectorAll(':scope > li[data-palier]')];
    expect(paliers).toHaveLength(8);
    paliers.forEach((palier, rang) => {
      expect(palier.dataset.palier).toBe(String(rang));
      expect(palier.textContent).toContain(t('generation.priorites.palier', { palier: rang + 1, paliers: 8 }));
    });
    const etats = etatsDesCriteres(charge(m));
    for (const nom of CRITERES) {
      expect(critereDe(m, nom).textContent, nom).toContain(t(`mobilier.critere.${nom}`));
      const etat = etatAffiche(etats.get(nom));
      for (const ecrit of ['decoche', 'sansObjet']) {
        expect(critereDe(m, nom).textContent.includes(t(`generation.priorites.etat.${ecrit}`)), `${nom} ${ecrit}`).toBe(etat === ecrit);
      }
    }
    // La petite démonstration ne porte aucun objectif, et sa case des
    // animateurs est décochée.
    expect(etatAffiche(etats.get(HORS_OBJECTIF))).toBe('sansObjet');
    expect(etatAffiche(etats.get(ANIMATEURS))).toBe('decoche');
    // Ni liste de conflits : le conflit d'organisation, en tête, est sans
    // objet.
    expect(etatAffiche(etats.get(CONFLITS))).toBe('sansObjet');
    expect(paliers[0].contains(critereDe(m, CONFLITS))).toBe(true);
    expect(editeur(m).querySelector('input[data-champ^="poids."]')).toBeNull();
    expect(editeur(m).textContent).toContain(t('generation.priorites.parDefaut'));
    expect(annonce(m)).toBe('');
  });

  test('rouge : les gestes offerts sont ceux du modèle sous l’admission de la commande ; ni « joindre » ni « séparer » pour l’écart et les rencontres répétées, ni « joindre » pour le critère qui suit l’un ou l’autre', async () => {
    const m = await demonstration();
    const admet = admissionSous(charge(m).reglages);
    for (const nom of CRITERES) expect(offerts(m, nom), nom).toEqual(gestesOfferts(ordreDe(m), nom, admet));
    for (const nom of [CONFLITS, ECART, EXCEDENT, CUMULEES, REPETEES, HORS_OBJECTIF]) expect(offerts(m, nom), nom).not.toContain('joindrePalier');
    for (const nom of CRITERES) expect(offerts(m, nom), nom).not.toContain('separerPalier');
    expect(offerts(m, CONFLITS)).toEqual(['descendreCritere']);
    expect(offerts(m, EXCEDENT)).toEqual(['monterCritere', 'descendreCritere']);
    expect(offerts(m, REPETEES)).toEqual(['monterCritere', 'descendreCritere']);
    expect(offerts(m, ECART)).toEqual(['monterCritere', 'descendreCritere']);
    expect(offerts(m, REDONDANCE)).toEqual(['monterCritere', 'joindrePalier']);
    // Aucun bouton ne nomme une touche.
    for (const b of editeur(m).querySelectorAll('button')) expect(b.textContent).not.toMatch(/Alt|Ctrl|Maj|↑|↓|Entrée/);
  });

  test('chaque bouton de l’éditeur a un nom accessible à lui, qui nomme le critère qu’il déplace, au défaut comme dans un palier partagé', async () => {
    const m = await demonstration();
    // Le nom accessible d'un bouton sans aria-label ni aria-labelledby est
    // son texte.
    const noms = () =>
      [...editeur(m).querySelectorAll('button')].map((b) => {
        expect(b.hasAttribute('aria-label') || b.hasAttribute('aria-labelledby')).toBe(false);
        return b.textContent.trim();
      });
    const verifier = () => {
      const tous = noms();
      expect(new Set(tous).size, tous.join(' | ')).toBe(tous.length);
      for (const nom of CRITERES) {
        for (const b of critereDe(m, nom).querySelectorAll('button[data-commande]')) {
          expect(b.textContent, `${nom} ${b.dataset.commande}`).toContain(t(`mobilier.critere.${nom}`));
        }
      }
    };
    verifier();
    await cliquer(m, bouton(m, REDONDANCE, 'joindrePalier'));
    expect(bouton(m, ANIMATEURS, 'monterCritere')).not.toBeNull();
    verifier();
  });

  test('un geste au pointeur : une commande, une entrée ; l’annonce dit le palier ; le focus suit le critère déplacé ; un poids par critère du palier partagé', async () => {
    const m = await demonstration();
    const [r0, e0] = [revision(m), journal(m)];
    const attendue = listeApres(LISTE_PAR_DEFAUT, 'joindrePalier', REDONDANCE);
    await cliquer(m, bouton(m, REDONDANCE, 'joindrePalier'));
    expect(revision(m)).toBe(r0 + 1);
    expect(journal(m)).toBe(e0 + 1);
    expect(charge(m).reglages.priorites).toEqual(attendue);
    expect(liste(m).querySelectorAll(':scope > li[data-palier]')).toHaveLength(7);
    expect(annonce(m)).toBe(t('generation.priorites.annonce', { critere: REDONDANCE, palier: 7, paliers: 7, avec: [ANIMATEURS] }));
    expect(critereDe(m, REDONDANCE).contains(document.activeElement)).toBe(true);
    expect(editeur(m).textContent).toContain(t('generation.priorites.regle'));
    const poids = [...editeur(m).querySelectorAll('input[data-champ^="poids."]')].map((e) => e.dataset.champ);
    expect(poids).toEqual([`poids.${ANIMATEURS}`, `poids.${REDONDANCE}`]);
    // Le palier du dessus, celui des tours hors objectif, se partage sous le
    // mode par défaut.
    expect(offerts(m, REDONDANCE)).toEqual(['monterCritere', 'joindrePalier', 'separerPalier']);
  });

  test('au clavier : Entrée sur « Monter », Espace sur « Descendre » ; chaque geste une entrée ; le focus reste sur le bouton du critère déplacé', async () => {
    const m = await demonstration();
    const e0 = journal(m);
    bouton(m, CUMULEES, 'monterCritere').focus();
    await presser(m, 'Enter');
    expect(charge(m).reglages.priorites).toEqual(listeApres(LISTE_PAR_DEFAUT, 'monterCritere', CUMULEES));
    expect(document.activeElement).toBe(bouton(m, CUMULEES, 'monterCritere'));
    bouton(m, CUMULEES, 'descendreCritere').focus();
    await presser(m, ' ');
    expect(charge(m).reglages.priorites).toBeUndefined();
    expect(journal(m)).toBe(e0 + 2);
    expect(document.activeElement).toBe(bouton(m, CUMULEES, 'descendreCritere'));
    expect(annonce(m)).toBe(t('generation.priorites.annonce', { critere: CUMULEES, palier: 4, paliers: 8, avec: [] }));
  });

  test('le poids d’un critère d’un palier partagé : un champ nombre étroit de 1 à 100 ; 0 refusé contre son champ, rien d’écrit ; 5 écrit, une entrée', async () => {
    const m = await demonstration();
    await cliquer(m, bouton(m, REDONDANCE, 'joindrePalier'));
    const champ = () => editeur(m).querySelector(`input[data-champ="poids.${REDONDANCE}"]`);
    expect(editeur(m).querySelector(`label[for="${champ().id}"]`).textContent.trim()).toBe(t('generation.priorites.poids', { critere: REDONDANCE }));
    expect([champ().type, champ().min, champ().max, champ().step]).toEqual(['number', '1', '100', '1']);
    // Étroit : six caractères de large, le contenu de la boîte, flèches
    // comprises.
    const sonde = document.createElement('span');
    sonde.style.cssText = 'position:absolute;font:inherit;visibility:hidden';
    sonde.textContent = '0'.repeat(6);
    champ().parentElement.append(sonde);
    const sixCaracteres = sonde.getBoundingClientRect().width;
    sonde.remove();
    const style = getComputedStyle(champ());
    expect(Number.parseFloat(style.width)).toBeCloseTo(sixCaracteres, 0);
    const e0 = journal(m);
    await cliquer(m, champ());
    champ().select();
    await touche('0');
    await presser(m, 'Tab');
    expect(champ().parentElement.querySelector('[data-refus="POIDS_HORS_DOMAINE"]')).not.toBeNull();
    expect(journal(m)).toBe(e0);
    await cliquer(m, champ());
    champ().select();
    await touche('5');
    await presser(m, 'Enter');
    expect(charge(m).reglages.priorites.at(-1)).toEqual([
      { critere: ANIMATEURS, poids: 1 },
      { critere: REDONDANCE, poids: 5 },
    ]);
    expect(journal(m)).toBe(e0 + 1);
  });

  test('« Rétablir l’ordre par défaut » : sans fenêtre, une entrée, le réglage retiré, annoncé', async () => {
    const m = await demonstration();
    await cliquer(m, bouton(m, REDONDANCE, 'joindrePalier'));
    const e0 = journal(m);
    await cliquer(m, editeur(m).querySelector('[data-commande="retablirPriorites"]'));
    expect(document.querySelector('dialog[open]')).toBeNull();
    expect(Object.hasOwn(charge(m).reglages, 'priorites')).toBe(false);
    expect(journal(m)).toBe(e0 + 1);
    expect(liste(m).querySelectorAll(':scope > li[data-palier]')).toHaveLength(8);
    expect(annonce(m)).toBe(t('generation.priorites.annonceRetablie'));
  });

  test('le remède « Modifier » d’un geste refusé rend le focus au groupe de l’éditeur, jamais au corps de la page', async () => {
    const m = await demonstration({ ecriture: false });
    await cliquer(m, bouton(m, REDONDANCE, 'joindrePalier'));
    const remede = editeur(m).querySelector(':scope > [data-refus="MODE_LECTURE"] [data-commande="modifier"]');
    remede.focus();
    await cliquer(m, remede);
    await vi.waitFor(() => expect(editeur(m).querySelector('[data-refus="MODE_LECTURE"]')).toBeNull());
    await vi.waitFor(() => expect(document.activeElement).toBe(editeur(m)));
  });

  test('en lecture et sur un plan bloqué : le geste refusé contre la liste, avec son remède ; rien d’écrit', async () => {
    const m = await demonstration({ ecriture: false });
    const ecritures = m.trace.length;
    await cliquer(m, bouton(m, REDONDANCE, 'joindrePalier'));
    const lecture = editeur(m).querySelector(':scope > [data-refus="MODE_LECTURE"]');
    expect(lecture).not.toBeNull();
    // Le groupe de l'éditeur est décrit par le refus ; le focus reste sur
    // le bouton du geste.
    expect(editeur(m).getAttribute('aria-describedby')).toBe(lecture.id);
    expect(document.activeElement).toBe(bouton(m, REDONDANCE, 'joindrePalier'));
    expect(lecture.querySelector('[data-commande="modifier"]')).not.toBeNull();
    expect(Object.hasOwn(charge(m).reglages, 'priorites')).toBe(false);
    expect(m.trace.length).toBe(ecritures);

    await m.seance.passerEnEcriture();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    const ecrituresBloque = m.trace.length;
    await cliquer(m, bouton(m, CUMULEES, 'monterCritere'));
    expect(editeur(m).querySelector(':scope > [data-refus="LECTURE_SEULE"] [data-commande="debloquer"]')).not.toBeNull();
    expect(Object.hasOwn(charge(m).reglages, 'priorites')).toBe(false);
    expect(m.trace.length).toBe(ecrituresBloque);
  });
});

describe('le mode des objectifs (§ 5.3, A8, A12, D22, D23)', () => {
  test('sous la case « Respecter les objectifs des tables » : sa légende, trois boutons radio expliqués, le défaut choisi, l’état du critère écrit à côté', async () => {
    const m = await demonstration();
    const caseObjectifs = section(m).querySelector('input[type="checkbox"][data-champ="respecterObjectifs"]');
    const caseAnimateurs = section(m).querySelector('input[type="checkbox"][data-champ="rencontrerAnimateurs"]');
    expect(caseObjectifs.compareDocumentPosition(groupe(m)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(groupe(m).compareDocumentPosition(caseAnimateurs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(groupe(m).tagName).toBe('FIELDSET');
    expect(groupe(m).querySelector('legend').textContent.trim()).toBe(t('generation.reglage.modeObjectifs'));
    for (const valeur of MODES_OBJECTIFS) {
      const r = radio(m, valeur);
      expect(groupe(m).querySelector(`label[for="${r.id}"]`).textContent.trim()).toBe(t(`generation.reglage.modeObjectifs.${valeur}`));
      expect(document.getElementById(r.getAttribute('aria-describedby')).textContent.trim()).toBe(
        t(`generation.reglage.modeObjectifs.${valeur}.explication`),
      );
      expect(r.checked, valeur).toBe(valeur === 'places');
    }
    expect(groupe(m).textContent).toContain(t('generation.reglage.modeObjectifs.etat.sansObjet'));
  });

  test('un choix au pointeur, une entrée ; au clavier, la flèche choisit le voisin ; l’état décoché s’écrit sans recalcul', async () => {
    const m = await demonstration();
    const e0 = journal(m);
    await cliquer(m, radio(m, 'chacun'));
    expect(charge(m).reglages.modeObjectifs).toBe('chacun');
    expect(radio(m, 'chacun').checked).toBe(true);
    expect(journal(m)).toBe(e0 + 1);
    radio(m, 'chacun').focus();
    await presser(m, 'ArrowDown');
    expect(charge(m).reglages.modeObjectifs).toBe('minimum');
    expect(radio(m, 'minimum').checked).toBe(true);
    expect(journal(m)).toBe(e0 + 2);
    await cliquer(m, section(m).querySelector('input[type="checkbox"][data-champ="respecterObjectifs"]'));
    expect(groupe(m).textContent).toContain(t('generation.reglage.modeObjectifs.etat.decoche'));
    // Toujours modifiable, case décochée.
    await cliquer(m, radio(m, 'places'));
    expect(Object.hasOwn(charge(m).reglages, 'modeObjectifs')).toBe(false);
  });

  test('rouge : sous « chacun », pas de « joindre » au palier des tours hors objectif ; joints, « l’équité d’abord » refusé contre le groupe, le choix revenu', async () => {
    const m = await demonstration();
    // Les animateurs suivent les tours hors objectif : les joindre partage
    // leur palier.
    await cliquer(m, radio(m, 'chacun'));
    expect(offerts(m, ANIMATEURS)).not.toContain('joindrePalier');
    await cliquer(m, radio(m, 'places'));
    expect(offerts(m, ANIMATEURS)).toContain('joindrePalier');
    await cliquer(m, bouton(m, ANIMATEURS, 'joindrePalier'));
    const e0 = journal(m);
    await cliquer(m, radio(m, 'minimum'));
    const refus = groupe(m).querySelector('[data-refus="OBJECTIFS_PALIER_PARTAGE"]');
    expect(refus).not.toBeNull();
    expect(refus.querySelector(':scope > p').textContent).toBe(t('OBJECTIFS_PALIER_PARTAGE', { mode: 'minimum', palier: 5 }));
    // Chaque bouton radio est décrit par le refus, en plus de son
    // explication ; le focus reste dans le groupe.
    expect(refus.id).not.toBe('');
    for (const valeur of MODES_OBJECTIFS) {
      expect(radio(m, valeur).getAttribute('aria-describedby').split(' '), valeur).toContain(refus.id);
    }
    expect(groupe(m).contains(document.activeElement)).toBe(true);
    expect(radio(m, 'places').checked).toBe(true);
    expect(radio(m, 'minimum').checked).toBe(false);
    expect(Object.hasOwn(charge(m).reglages, 'modeObjectifs')).toBe(false);
    expect(journal(m)).toBe(e0);
  });

  test('en lecture : le choix refusé contre le groupe, le mode inchangé, le choix revenu', async () => {
    const m = await demonstration({ ecriture: false });
    await cliquer(m, radio(m, 'chacun'));
    expect(groupe(m).querySelector('[data-refus="MODE_LECTURE"]')).not.toBeNull();
    expect(radio(m, 'places').checked).toBe(true);
    expect(radio(m, 'chacun').checked).toBe(false);
    expect(Object.hasOwn(charge(m).reglages, 'modeObjectifs')).toBe(false);
  });

  test('sur un plan bloqué : le choix refusé contre le groupe, avec « Débloquer » ; rien d’écrit, le choix revenu', async () => {
    const m = await demonstration();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    const ecritures = m.trace.length;
    await cliquer(m, radio(m, 'chacun'));
    expect(groupe(m).querySelector('[data-refus="LECTURE_SEULE"] [data-commande="debloquer"]')).not.toBeNull();
    expect(radio(m, 'places').checked).toBe(true);
    expect(radio(m, 'chacun').checked).toBe(false);
    expect(m.trace.length).toBe(ecritures);
    expect(Object.hasOwn(charge(m).reglages, 'modeObjectifs')).toBe(false);
  });
});

describe('le contraste de l’éditeur et du choix du mode (§ 14.5)', () => {
  test('chaque texte, poids et refus compris, à 4,5:1 au moins dans les deux thèmes, mesuré au rendu', async () => {
    const m = await demonstration();
    // Un palier partagé, ses poids, et un refus contre le groupe du mode.
    await cliquer(m, bouton(m, ANIMATEURS, 'joindrePalier'));
    await cliquer(m, radio(m, 'minimum'));
    expect(groupe(m).querySelector('[data-refus]')).not.toBeNull();
    expect(editeur(m).querySelectorAll('input[data-champ^="poids."]')).toHaveLength(2);
    // Une faute est un texte sous 4,5:1 ou sans fond opaque dessous : la
    // liste vide porte le seuil.
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        for (const [nom, racine] of [['éditeur', editeur(m)], ['mode', groupe(m)]]) {
          const { fautes, mesures } = releverTextes(racine);
          expect(mesures, `${theme} ${nom}`).toBeGreaterThan(3);
          expect(fautes, `${theme} ${nom}`).toEqual([]);
        }
      });
    }
  });
});
