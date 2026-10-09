// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les réglages de génération montrés depuis leur définition, dans un vrai
// moteur de rendu (§ 5.3, § 5.7, § 19.8) : Reglages.svelte, monté par mount
// avec les contextes que pose App — 't', 'seance', 'generation' —, sur une
// séance du système de fichiers simulé et l'horloge pilotée, montre chaque
// entrée de la section 'generation' de REGLAGES_GENERATION dans son ordre,
// sous son libellé, à la valeur de la charge, et aucune d'une autre section ;
// une définition passée par l'épreuve, une entrée ajoutée ou retirée, change
// l'écran de même. Le texte attendu vient de la
// même traduction que celle de l'application ; les noms d'épreuve sont
// inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, describe, expect, test } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import '../jetons.css';
import { creerControleurGeneration, creerExecuteurDirect } from '../../application/generation.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerSeance } from '../../application/seance.js';
import { creerTraduction } from '../../application/traduction.js';
import { VERSION } from '../../version.genere.js';
import { creerFichiersSimules } from '../../../test/fichiers_simules.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Reglages from './Reglages.svelte';
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

// L'entrée désignée par sa clé, et le texte de son libellé.
const entree = (cible, cle) => cible.querySelector(`input[data-champ="${cle}"]`);
const libelleDe = (cible, cle) => cible.querySelector(`label[for="${entree(cible, cle).id}"]`).textContent.trim();

describe('Reglages : l’écran montre la définition (§ 19.8)', () => {
  test('la définition livrée : la graine, chaque entrée de la génération dans son ordre, sous son libellé, à la valeur de la charge, puis les cœurs ; la cible des propositions n’y est pas', async () => {
    const cible = await monter();
    expect(DE_LA_GENERATION.length).toBeGreaterThan(0);
    expect(DE_LA_GENERATION.length).toBeLessThan(REGLAGES_GENERATION.length);
    expect(designations(cible)).toEqual(['graine', ...DE_LA_GENERATION.map(({ cle }) => cle), 'coeursAutomatiques']);
    expect(cible.querySelector('[data-champ="cibleRedondance"]')).toBeNull();
    for (const { cle, etiquette, genre, defaut } of DE_LA_GENERATION) {
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
    const cles = DE_LA_GENERATION.map(({ cle: c }) => c);
    expect(designations(cible)).toEqual(['graine', cles[0], 'generation.epreuve', ...cles.slice(1), 'epreuveBascule', 'coeursAutomatiques']);
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
