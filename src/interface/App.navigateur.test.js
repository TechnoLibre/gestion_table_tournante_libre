// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La coquille de l'application dans un vrai moteur de rendu : le titre de la
// fenêtre et le bandeau (§ 8.4, § 18.6), « Liste des événements » (§ 8.1),
// le panneau « À propos », le thème du lancement et de la séance, que le
// panneau « Paramètres » règle (§ 19.2), le collecteur
// d'erreurs, l'injection des plateformes (§ 13.4), l'ordre du montage, la
// liste relue et l'abandon des résumés d'une liste dépassée (§ 8.1), et la
// fermeture sans question (§ 8.4, § 8.8). Chaque épreuve monte App par
// monterApp (test/navigateur/montage.js), sur le système de fichiers simulé.
//
// Le test interroge le rendu, jamais la présence d'une classe (§ 14.2) : la
// visibilité de chaque élément, la boîte où la mise en page le pose et
// l'élément qu'atteint le centre de cette boîte, le style calculé, le texte,
// le titre de la fenêtre. Il ne lit aucun pixel : le contraste se calcule sur
// les couleurs calculées, qui ne sont les couleurs peintes que sans opacité
// partielle, filtre ni mode de fusion — ce qu'une épreuve vérifie dans
// l'ascendance de chaque texte (§ 14.5). Les épreuves de visibilité, de
// contraste et d'opacité passent par les deux thèmes, que l'attribut
// data-theme de <html> choisit (§ 19.2). Les mesures viennent du module
// partagé test/navigateur/rendu.js, dont le contraste est celui de
// palette.js, seule formule des WCAG du dépôt.
//
// Le projet navigateur n'importe pas node:assert/strict : côté navigateur,
// Vite le remplace par un module qui lève une erreur à tout accès. Il emploie
// expect, et prend test et describe chez Vitest plutôt que dans
// test/lanceur.js, dont le repli vers node:test ne vaut que pour la série node.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { flushSync } from 'svelte';
import { appliquerCommande } from '../application/commandes.js';
import { evaluer } from '../application/evaluation.js';
import { creerFormat } from '../application/format.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { LIVREES } from '../demo/livrees.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { FORMAT, analyser, configurationDepuisCharge } from '../stockage/document.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { VERSION } from '../version.genere.js';
import COLLECTEUR from '../../public/collecteur.js?raw';
import { fixerCadre } from '../../test/navigateur/entrees.js';
import { monterApp } from '../../test/navigateur/montage.js';
import {
  attenuations,
  composantes,
  contraste,
  couleurTexte,
  designation,
  fondPeintSous,
  porteursDeTexte,
  sousTheme,
  visible,
} from '../../test/navigateur/rendu.js';
import { blocAPropos } from './apropos.js';
import { TABLES_INTERFACE, libelleProvenance } from './libelles.js';
import { SECTION_OUVERTURE } from './evenement/sections.js';
import { cleDeMode } from './mode.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

const TRANSPARENT = 'rgba(0, 0, 0, 0)';
const THEMES = ['clair', 'sombre'];

// Un événement d'épreuve : le fichier d'état d'une démonstration livrée, son
// nom remplacé par un nom inventé, au format donné.
const PETITE = LIVREES.find(({ cle }) => cle === 'petite').texte;
const CONFLIT = LIVREES.find(({ cle }) => cle === 'petite-conflit').texte;
function evenement(nom, { texte = PETITE, format = FORMAT } = {}) {
  const renomme = texte.replace(/"nom":"[^"]*"/, `"nom":${JSON.stringify(nom)}`);
  const auFormat = renomme.replace(`"format":${FORMAT}`, `"format":${format}`);
  if (!renomme.includes(JSON.stringify(nom)) || !auFormat.includes(`"format":${format}`)) {
    throw new Error("le fichier d'épreuve ne se compose pas");
  }
  return auFormat;
}
const fichier = (base, nom, options) => ({ racine: 'documents', chemin: `${base}.gtt.json`, texte: evenement(nom, options) });
const verrouDe = (m, base) => m.fs.contenu('documents', `${base}.gtt.verrou`);

// Les montages de l'épreuve en cours, démontés après elle ; le collecteur
// n'a rien reçu pendant l'épreuve, sauf quand elle le veut.
let montes = [];
let erreursAdmises = false;
let erreursAvant = 0;
async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}
beforeEach(() => {
  erreursAvant = globalThis.__gttErreurs?.length ?? 0;
  erreursAdmises = false;
});
afterEach(() => {
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  vi.restoreAllMocks();
  const recues = globalThis.__gttErreurs?.slice(erreursAvant) ?? [];
  if (!erreursAdmises) expect(recues, 'erreurs reçues par le collecteur').toEqual([]);
});

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const bandeau = (m) => dans(m, '[data-bandeau]');
const libelleDeMode = (m) => dans(m, '[data-mode-libelle="bandeau"]');
const ecran = (m) => dans(m, '[data-ecran]');

// Un montage dont l'événement « Bal des Grisailles » est ouvert, en lecture.
async function avecEvenementOuvert(options = {}) {
  const m = await monter({ fichiers: [fichier('bal', 'Bal des Grisailles')], ...options });
  await m.seance.ouvrir('bal');
  flushSync();
  return m;
}

// Le bandeau, puis chacun de ses porteurs de texte.
const bandeauEtTextes = (m) => [{ element: bandeau(m), pseudo: null }, ...porteursDeTexte(bandeau(m))];

describe('titre et bandeau (§ 8.4, § 18.6)', () => {
  test('le titre de la fenêtre vaut exactement le nom suivi de la version affichée', async () => {
    await monter();
    expect(document.title).toBe(`Gestion table tournante Libre — ${VERSION.affichee}`);
  });

  test('le bandeau est visible, dans la fenêtre, et porte la version affichée et la provenance ; sans événement, aucun libellé de mode', async () => {
    const m = await monter();
    expect(visible(bandeau(m))).toBe(true);
    expect(bandeau(m).textContent).toContain(VERSION.affichee);
    expect(bandeau(m).textContent).toContain(libelleProvenance('test'));
    expect(libelleDeMode(m)).toBeNull();
  });

  test('un événement en lecture, en écriture, puis bloqué : le libellé de mode de chaque état, de la clé que rend cleDeMode', async () => {
    const m = await avecEvenementOuvert();
    const attendus = [];
    const relever = () => {
      flushSync();
      const cle = cleDeMode(m.seance.etat());
      attendus.push(cle);
      expect(visible(libelleDeMode(m))).toBe(true);
      expect(libelleDeMode(m).textContent).toBe(t(cle));
    };
    relever();
    await m.seance.passerEnEcriture();
    relever();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    relever();
    expect(attendus).toEqual(['coquille.mode.lecture', 'coquille.mode.ecriture', 'coquille.mode.bloque']);
  });

  test('le bandeau ne défile pas : la page défilée jusqu’en bas, il reste dans la fenêtre et son centre l’atteint', async () => {
    const m = await monter();
    const haut = document.createElement('div');
    haut.style.height = '3000px';
    ecran(m).append(haut);
    window.scrollTo(0, document.documentElement.scrollHeight);
    expect(window.scrollY).toBeGreaterThan(0);
    const boite = bandeau(m).getBoundingClientRect();
    expect(boite.top).toBeGreaterThanOrEqual(0);
    expect(boite.bottom).toBeLessThanOrEqual(window.innerHeight);
    const atteint = document.elementFromPoint(boite.left + boite.width / 2, boite.top + boite.height / 2);
    expect(bandeau(m).contains(atteint)).toBe(true);
    window.scrollTo(0, 0);
  });

  test('construction de documentation : la marque remplace le numéro ; en livraison, le numéro', async () => {
    const documentation = await monter({ provenance: 'documentation' });
    expect(bandeau(documentation).textContent).not.toContain(VERSION.affichee);
    expect(bandeau(documentation).textContent).toContain(t('sorties.version.documentation'));
    const accueil = (m) => dans(m, '[data-ecran="accueil"]');
    expect(accueil(documentation).textContent).not.toContain(VERSION.affichee);
    expect(accueil(documentation).textContent).toContain(t('sorties.version.documentation'));
    documentation.demonter();
    montes = [];
    const livraison = await monter({ provenance: 'livraison' });
    expect(bandeau(livraison).textContent).toContain(VERSION.affichee);
    expect(bandeau(livraison).textContent).toContain(libelleProvenance('livraison'));
    expect(accueil(livraison).textContent).toContain(VERSION.affichee);
    expect(accueil(livraison).textContent).not.toContain(t('sorties.version.documentation'));
  });
});

describe('annonce de format (§ 8.8, § 18.6)', () => {
  const annonce = (m) => dans(m, '[data-avertissement="annonceFormat"]');

  test('un fichier au format FORMAT + 1 : « ce fichier s’ouvre en lecture seule » dans le bandeau', async () => {
    const m = await monter({ fichiers: [fichier('bal', 'Bal des Grisailles', { format: FORMAT + 1 })] });
    await m.seance.ouvrir('bal');
    flushSync();
    expect(bandeau(m).contains(annonce(m))).toBe(true);
    expect(annonce(m).textContent).toBe(t('coquille.format.plusRecent'));
    expect(annonce(m).textContent).toMatch(/s.ouvre en lecture seule/);
  });

  test('au format courant : aucune annonce', async () => {
    const m = await avecEvenementOuvert();
    expect(annonce(m)).toBeNull();
  });

  test('formatCourant à FORMAT + 1, fichier au format FORMAT : « ce fichier se convertira… », et l’ouverture n’ajoute rien au relevé', async () => {
    const m = await monter({ formatCourant: FORMAT + 1, fichiers: [fichier('bal', 'Bal des Grisailles')] });
    const avant = m.trace.length;
    await m.seance.ouvrir('bal');
    flushSync();
    expect(annonce(m).textContent).toBe(t('coquille.format.plusAncien'));
    expect(annonce(m).textContent).toMatch(/se convertira à votre première modification/);
    expect(m.trace.length).toBe(avant);
  });
});

describe('« Liste des événements » (§ 8.1, § 8.4)', () => {
  const commande = (m) => dans(m, '[data-commande="liste"]');

  test('absente sans événement ouvert', async () => {
    const m = await monter();
    expect(commande(m)).toBeNull();
  });

  test('un événement en écriture, la commande cliquée : l’accueil revient, sans fenêtre ni question, le verrou rendu, aucun libellé de mode', async () => {
    const fenetres = ['confirm', 'alert', 'prompt'].map((nom) => vi.spyOn(window, nom));
    const m = await avecEvenementOuvert();
    await m.seance.passerEnEcriture();
    expect(verrouDe(m, 'bal')).not.toBeNull();
    flushSync();
    expect(visible(commande(m))).toBe(true);
    commande(m).click();
    await vi.waitFor(() => expect(m.seance.etat().evenement).toBeNull());
    flushSync();
    expect(ecran(m).dataset.ecran).toBe('accueil');
    expect(verrouDe(m, 'bal')).toBeNull();
    expect(libelleDeMode(m)).toBeNull();
    for (const fenetre of fenetres) expect(fenetre).not.toHaveBeenCalled();
  });

  test('sous un support rompu, la séance refuse de fermer : le refus s’affiche à côté de la commande, et l’événement reste ouvert', async () => {
    const m = await avecEvenementOuvert();
    await m.seance.passerEnEcriture();
    m.fs.pannes.ecriture('documents');
    await expect(m.seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } })).rejects.toMatchObject({
      code: 'ECRITURE',
    });
    expect(m.seance.etat().supportRompu).not.toBeNull();
    const leve = await m.seance.fermer().then(
      () => null,
      (erreur) => erreur,
    );
    expect(leve?.code).toBe('SUPPORT_ROMPU_NON_SAUVE');
    flushSync();
    commande(m).click();
    const refus = await vi.waitFor(() => {
      const element = dans(m, '[data-refus="liste"]');
      expect(element).not.toBeNull();
      return element;
    });
    const remede = leve.details.remede;
    expect(remede.geste).toBe('ecrireAilleurs');
    const cleRemede = `communs.remede.ecrireAilleurs.${remede.racine ? 'documents' : 'choisi'}`;
    expect(refus.textContent).toContain(t(leve.code, leve.details));
    const commandeRemede = refus.querySelector('[data-commande="ecrireAilleurs"]');
    expect(commandeRemede?.textContent).toBe(t(cleRemede));
    expect(visible(refus)).toBe(true);
    expect(visible(commandeRemede)).toBe(true);
    // Posé dans le bandeau, le refus garde sa lisibilité : chaque texte tient
    // 4,5:1 sur chaque couleur peinte sous lui, dans les deux thèmes.
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        for (const porteur of porteursDeTexte(refus)) {
          const lieu = `${theme} : ${designation(porteur)}`;
          const texte = couleurTexte(porteur);
          for (const fond of fondPeintSous(porteur)) {
            expect(contraste(texte, fond), `${lieu} sur ${fond.join(', ')}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      });
    }
    expect(m.seance.etat().evenement?.base).toBe('bal');
    expect(ecran(m).dataset.ecran).toBe('evenement');
  });
});

describe('la liste relue', () => {
  test('un événement chargé puis fermé : la liste revenue le porte', async () => {
    const m = await monter();
    expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(0);
    const { base } = await m.facade.chargerDemonstration('petite');
    flushSync();
    expect(ecran(m).dataset.ecran).toBe('evenement');
    dans(m, '[data-commande="liste"]').click();
    await vi.waitFor(() => expect(m.seance.etat().evenement).toBeNull());
    await vi.waitFor(() => expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(1));
    expect(dans(m, '[data-evenement]').dataset.evenement).toBe(base);
  });

  test('une relecture refusée : le refus traduit tient lieu de liste, sans ligne d’avant ; la relecture suivante le retire', async () => {
    const m = await monter({ fichiers: [fichier('bal', 'Bal des Grisailles')] });
    expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(1);
    expect(dans(m, '[data-refus="accueil"]')).toBeNull();
    // L'ouverture relève aussi le dossier : le relevé ne se refuse qu'après
    // elle.
    await m.seance.ouvrir('bal');
    const refuse = new ErreurStockage('LECTURE', { chemin: '', cause: 'EACCES' });
    const lister = m.fs.lister;
    m.fs.lister = async () => {
      throw refuse;
    };
    await m.seance.fermer();
    const refus = await vi.waitFor(() => {
      const element = dans(m, '[data-refus="accueil"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(refus.textContent).toBe(t(refuse.code, refuse.details));
    expect(visible(refus)).toBe(true);
    expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(0);
    m.fs.lister = lister;
    await m.seance.ouvrir('bal');
    await m.seance.fermer();
    await vi.waitFor(() => expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(1));
    expect(dans(m, '[data-refus="accueil"]')).toBeNull();
  });

  test('une détermination refusée : pret se résout, et l’accueil montre le refus traduit, sans ligne', async () => {
    // Un disque dont le relevé d'un dossier se refuse : la détermination du
    // dossier de travail, qui relève le dossier retenu, rejette.
    const refuse = new ErreurStockage('LECTURE', { chemin: '', cause: 'EACCES' });
    class DisqueIllisible extends Map {
      values() {
        throw refuse;
      }
    }
    const m = await monter({ systeme: { disque: new DisqueIllisible() } });
    expect(ecran(m)?.dataset.ecran).toBe('accueil');
    const refus = dans(m, '[data-refus="accueil"]');
    expect(refus?.textContent).toBe(t(refuse.code, refuse.details));
    expect(visible(refus)).toBe(true);
    expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(0);
  });

  test('une détermination refusée au montage, puis réussie par un nouveau demarrer : la liste se lit, et le refus part', async () => {
    // Un disque dont seul le premier relevé se refuse : la façade ne garde
    // rien d'une détermination refusée, et le demarrer suivant la refait.
    const refuse = new ErreurStockage('LECTURE', { chemin: '', cause: 'EACCES' });
    let releves = 0;
    class DisqueUneFoisIllisible extends Map {
      values() {
        releves += 1;
        if (releves === 1) throw refuse;
        return super.values();
      }
    }
    const m = await monter({ systeme: { disque: new DisqueUneFoisIllisible() } });
    expect(dans(m, '[data-refus="accueil"]')?.textContent).toBe(t(refuse.code, refuse.details));
    await m.facade.demarrer();
    await vi.waitFor(() => expect(dans(m, '[data-refus="accueil"]')).toBeNull());
  });

  test('deux lectures qui se chevauchent : la plus ancienne, finie la dernière, ne remet pas sa liste', async () => {
    const m = await monter({ fichiers: [fichier('bal', 'Bal des Grisailles')] });
    expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(1);
    // La première lecture d'après la fermeture reste suspendue sur le
    // verrou de « bal », après avoir relevé le dossier.
    let liberer;
    const barriere = new Promise((resoudre) => {
      liberer = resoudre;
    });
    let suspendue = null;
    const lireTexte = m.fs.lireTexte;
    m.fs.lireTexte = (racine, chemin) => {
      if (chemin === 'bal.gtt.verrou' && suspendue === null) {
        suspendue = barriere.then(() => lireTexte.call(m.fs, racine, chemin));
        return suspendue;
      }
      return lireTexte.call(m.fs, racine, chemin);
    };
    await m.seance.ouvrir('bal');
    await m.seance.fermer();
    await vi.waitFor(() => expect(suspendue).not.toBeNull());
    // Un second événement paraît ; une seconde fermeture relit la liste, qui
    // le porte.
    m.fs.deposer('documents', 'club.gtt.json', evenement('Club des Merles', { texte: CONFLIT }));
    await m.seance.ouvrir('bal');
    await m.seance.fermer();
    await vi.waitFor(() => expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(2));
    liberer();
    await suspendue.catch(() => undefined);
    // Le verrou est la dernière lecture de la liste suspendue : une image
    // plus tard, elle a rendu ses lignes.
    await new Promise((resoudre) => requestAnimationFrame(() => resoudre()));
    flushSync();
    expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(2);
  });
});

describe('les résumés de la liste relue (§ 8.1)', () => {
  // La petite démonstration au conflit inévitable, deux propositions du
  // moteur, celle du rang donné retenue.
  function texteRetenu(rang) {
    let charge = analyser(CONFLIT).charge;
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 6, nombre: 2, arret: 300 });
    charge = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
    charge = appliquerCommande('retenirProposition', charge, { id: charge.propositions[rang].id }).charge;
    return serialiser(charge, { revision: 1, produitVersion: VERSION.affichee });
  }
  // Les collisions cumulées du retenu que la ligne d'un texte d'état écrit.
  const collisions = (texte) => format.nombre(evaluer(analyser(texte).charge).retenu.mesures.collisionsCumulees);
  const cellule = (m) => dans(m, '[data-evenement="bal"] [data-colonne="collisionsCumulees"]');
  const uneImage = () => new Promise((resoudre) => requestAnimationFrame(() => resoudre()));

  // Retient la prochaine lecture de l'état de « bal » : elle lit le disque à
  // son appel, et ne rend ce qu'elle a lu qu'à liberer().
  function retenirLecture(m) {
    const lireTexte = m.fs.lireTexte;
    let liberer;
    const barriere = new Promise((resoudre) => {
      liberer = resoudre;
    });
    const retenue = { promesse: null, liberer: () => liberer() };
    m.fs.lireTexte = (racine, chemin) => {
      if (chemin === 'bal.gtt.json' && retenue.promesse === null) {
        const lue = lireTexte.call(m.fs, racine, chemin);
        retenue.promesse = barriere.then(() => lue);
        return retenue.promesse;
      }
      return lireTexte.call(m.fs, racine, chemin);
    };
    return retenue;
  }

  test('une relecture pendant le chargement : la ligne ne montre jamais la valeur de l’ancienne lecture, même finie la dernière', async () => {
    const ancien = texteRetenu(1);
    const nouveau = texteRetenu(0);
    expect(collisions(ancien)).not.toBe(collisions(nouveau));
    const m = await monter({ fichiers: [{ racine: 'documents', chemin: 'bal.gtt.json', texte: ancien }] });
    const retenue = retenirLecture(m);
    // Le premier pas de la première lecture lit l'état, et reste suspendu.
    await vi.waitFor(async () => {
      await uneImage();
      m.horloge.avancer(0);
      expect(retenue.promesse).not.toBeNull();
    });
    m.fs.deposer('documents', 'bal.gtt.json', nouveau);
    await m.facade.demarrer();
    flushSync();
    expect(cellule(m).querySelector('[data-chargement]')).not.toBeNull();
    await vi.waitFor(async () => {
      await uneImage();
      m.horloge.avancer(0);
      flushSync();
      expect(cellule(m).textContent).toBe(collisions(nouveau));
    });
    // La lecture d'avant s'achève : son calcul ne se pose pas.
    retenue.liberer();
    await retenue.promesse;
    for (let image = 0; image < 3; image += 1) await uneImage();
    m.horloge.avancer(0);
    flushSync();
    expect(cellule(m).textContent).toBe(collisions(nouveau));
  });

  test('un événement ouvert pendant le chargement l’abandonne : l’horloge avancée ne relit plus aucun état', async () => {
    const m = await monter({
      fichiers: [
        { racine: 'documents', chemin: 'bal.gtt.json', texte: texteRetenu(1) },
        { racine: 'documents', chemin: 'club.gtt.json', texte: evenement('Club des Merles', { texte: CONFLIT }) },
      ],
    });
    expect(m.racine.querySelectorAll('[data-chargement]').length).toBeGreaterThan(0);
    await m.seance.ouvrir('bal');
    flushSync();
    const lireTexte = m.fs.lireTexte;
    const etats = [];
    m.fs.lireTexte = (racine, chemin) => {
      if (chemin.endsWith('.gtt.json')) etats.push(chemin);
      return lireTexte.call(m.fs, racine, chemin);
    };
    for (let pas = 0; pas < 4; pas += 1) {
      await uneImage();
      m.horloge.avancer(0);
    }
    expect(etats).toEqual([]);
  });

  test('une lecture de la liste qui s’achève sous un événement ouvert ne lance aucun chargement', async () => {
    const m = await monter({
      fichiers: [
        { racine: 'documents', chemin: 'bal.gtt.json', texte: texteRetenu(1) },
        { racine: 'documents', chemin: 'club.gtt.json', texte: evenement('Club des Merles', { texte: CONFLIT }) },
      ],
    });
    await m.seance.ouvrir('bal');
    flushSync();
    // La lecture de la liste que lance la fermeture lit le dossier à son
    // appel, et ne rend ce qu'elle a lu qu'à liberer().
    const lister = m.facade.lister;
    let liberer;
    const barriere = new Promise((resoudre) => {
      liberer = resoudre;
    });
    m.facade.lister = (...arguments_) => {
      const lue = lister(...arguments_);
      return barriere.then(() => lue);
    };
    await m.seance.fermer();
    await m.seance.ouvrir('club');
    flushSync();
    const lireTexte = m.fs.lireTexte;
    const etats = [];
    m.fs.lireTexte = (racine, chemin) => {
      if (chemin.endsWith('.gtt.json')) etats.push(chemin);
      return lireTexte.call(m.fs, racine, chemin);
    };
    liberer();
    for (let pas = 0; pas < 4; pas += 1) {
      await uneImage();
      m.horloge.avancer(0);
    }
    expect(m.seance.etat().evenement?.base).toBe('club');
    expect(etats).toEqual([]);
  });
});

describe('l’événement ouvert et sa navigation', () => {
  test('chaque ouverture remet la navigation à son départ : la section d’ouverture, montrée', async () => {
    const m = await avecEvenementOuvert();
    expect(m.ui.etat().section).toBe(SECTION_OUVERTURE);
    expect(dans(m, `[data-section="${SECTION_OUVERTURE}"]`)).not.toBeNull();
    dans(m, '[data-commande="section"][data-cible="tables"]').click();
    flushSync();
    expect(m.ui.etat().section).toBe('tables');
    expect(dans(m, '[data-section="tables"]')).not.toBeNull();
    dans(m, '[data-commande="liste"]').click();
    await vi.waitFor(() => expect(m.seance.etat().evenement).toBeNull());
    await m.seance.ouvrir('bal');
    flushSync();
    expect(m.ui.etat().section).toBe(SECTION_OUVERTURE);
    expect(dans(m, '[data-section]').dataset.section).toBe(SECTION_OUVERTURE);
  });
});

describe('« À propos » (§ 18.6)', () => {
  const panneau = (m) => dans(m, '[data-ecran="apropos"]');
  // Le panneau est plus haut que la fenêtre : il s'ouvre en haut, son titre
  // visible.
  const titre = (m) => dans(m, '[data-ecran="apropos"] > h1');

  test('le panneau s’ouvre depuis le bandeau sur la liste puis sur un événement ; « Copier » remet exactement le bloc affiché', async () => {
    const m = await monter({ fichiers: [fichier('bal', 'Bal des Grisailles')] });
    const attendu = blocAPropos({ version: VERSION.affichee, plateforme: m.fs.nature, provenance: 'test', format: FORMAT }, t);
    dans(m, '[data-commande="apropos"]').click();
    flushSync();
    expect(visible(titre(m))).toBe(true);
    const bloc = dans(m, '[data-bloc]');
    expect(bloc.textContent).toBe(attendu);
    dans(m, '[data-commande="copier"]').click();
    await vi.waitFor(() => expect(m.presse.copies).toEqual([bloc.textContent]));
    dans(m, '[data-commande="fermerApropos"]').click();
    flushSync();
    expect(ecran(m).dataset.ecran).toBe('accueil');

    await m.seance.ouvrir('bal');
    flushSync();
    expect(ecran(m).dataset.ecran).toBe('evenement');
    dans(m, '[data-commande="apropos"]').click();
    flushSync();
    expect(visible(titre(m))).toBe(true);
    expect(dans(m, '[data-bloc]').textContent).toBe(attendu);
  });

  test('l’éditeur, l’auteur et son rôle s’y lisent, au-dessus du bloc ; « Copier » ne les emporte pas, ni la forme Windows', async () => {
    const m = await monter();
    dans(m, '[data-commande="apropos"]').click();
    flushSync();
    const credits = dans(m, '[data-credits]');
    expect(visible(credits)).toBe(true);
    expect(dans(m, '[data-editeur]').textContent.trim()).toBe('TechnoLibre Inc.');
    expect(dans(m, '[data-auteur]').textContent.trim()).toBe('Mathieu Benoit');
    expect(dans(m, '[data-role]').textContent.trim()).toBe('Développeur, concepteur et mainteneur du logiciel');
    expect(credits.compareDocumentPosition(dans(m, '[data-bloc]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(panneau(m).textContent.includes(VERSION.windows)).toBe(false);
    dans(m, '[data-commande="copier"]').click();
    await vi.waitFor(() => expect(m.presse.copies).toEqual([dans(m, '[data-bloc]').textContent]));
    expect(m.presse.copies[0]).not.toContain('TechnoLibre Inc.');
  });
});

describe('thème (§ 19.2)', () => {
  const preferer = (valeur) =>
    cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: valeur }] });
  const themePose = () => document.documentElement.getAttribute('data-theme');
  // Le choix d'un thème dans le panneau « Paramètres », ouvert du bandeau.
  const choixDuTheme = (m, choix) => {
    if (dans(m, '[data-ecran="parametres"]') === null) {
      dans(m, '[data-bandeau] [data-commande="parametres"]').click();
      flushSync();
    }
    return dans(m, `[data-ecran="parametres"] [data-commande="theme"][data-theme-choix="${choix}"]`);
  };

  test('(a) monté sans réglage, préférence sombre du système : thème sombre', async () => {
    await preferer('dark');
    try {
      expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(true);
      const m = await monter({ theme: null });
      flushSync();
      expect(themePose()).toBe('sombre');
      expect(choixDuTheme(m, 'sombre').getAttribute('aria-pressed')).toBe('true');
    } finally {
      await preferer('');
    }
  });

  test('(b) le réglage basculé à clair ne survit pas : un second montage sur le même disque repart de la préférence, et rien n’est écrit au stockage du navigateur', async () => {
    const ecritures = vi.spyOn(Storage.prototype, 'setItem');
    await preferer('dark');
    try {
      const premier = await monter({ theme: null });
      choixDuTheme(premier, 'clair').click();
      flushSync();
      expect(themePose()).toBe('clair');
      premier.demonter();
      montes = [];
      await monter({ theme: null, systeme: { disque: premier.disque } });
      flushSync();
      expect(themePose()).toBe('sombre');
      expect(ecritures).not.toHaveBeenCalled();
    } finally {
      await preferer('');
    }
  });

  test('(c) basculer le réglage change les couleurs calculées du corps et du bandeau, sans rechargement', async () => {
    const m = await monter();
    const couleurs = () =>
      [document.body, bandeau(m)].map((el) => {
        const style = getComputedStyle(el);
        return `${style.color} sur ${style.backgroundColor}`;
      });
    const clair = couleurs();
    const boutonSombre = choixDuTheme(m, 'sombre');
    expect(boutonSombre.getAttribute('aria-pressed')).toBe('false');
    boutonSombre.click();
    flushSync();
    expect(themePose()).toBe('sombre');
    expect(boutonSombre.getAttribute('aria-pressed')).toBe('true');
    const sombre = couleurs();
    expect(sombre[0]).not.toBe(clair[0]);
    expect(sombre[1]).not.toBe(clair[1]);
  });
});

describe('collecteur d’erreurs (§ 19.2)', () => {
  // Un cadre neuf dont la page charge le collecteur, puis le contenu donné.
  async function cadre(contenu) {
    const element = document.createElement('iframe');
    const charge = new Promise((resoudre) => element.addEventListener('load', resoudre, { once: true }));
    element.srcdoc = `<!doctype html><html><head><script>${COLLECTEUR}</` + `script>${contenu}</head><body><button id="b"></button></body></html>`;
    document.body.append(element);
    await charge;
    return element;
  }
  // Exécute du code dans la page du cadre, par un script classique inséré.
  function executer(element, code) {
    const doc = element.contentDocument;
    const script = doc.createElement('script');
    script.textContent = code;
    doc.body.append(script);
  }

  test('une erreur à l’évaluation d’un module chargé après lui est au tableau', async () => {
    const element = await cadre(`<script type="module">throw new Error('évaluation du module');</` + 'script>');
    try {
      const erreurs = element.contentWindow.__gttErreurs;
      expect(erreurs.map(({ type }) => type)).toEqual(['error']);
      expect(erreurs[0].message).toContain('évaluation du module');
    } finally {
      element.remove();
    }
  });

  test('une erreur levée dans un gestionnaire, une promesse rejetée sans gestionnaire, un console.error : trois entrées, dans cet ordre', async () => {
    const element = await cadre('');
    try {
      const erreurs = element.contentWindow.__gttErreurs;
      expect(erreurs).toEqual([]);
      executer(element, "document.getElementById('b').addEventListener('click', () => { throw new Error('gestionnaire'); }); document.getElementById('b').click();");
      expect(erreurs.length).toBe(1);
      executer(element, "Promise.reject(new Error('rejet'));");
      await vi.waitFor(() => expect(erreurs.length).toBe(2));
      executer(element, "console.error('console', 1);");
      expect(erreurs.map(({ type }) => type)).toEqual(['error', 'unhandledrejection', 'console.error']);
      expect(erreurs.map(({ message }) => message)).toEqual([
        expect.stringContaining('gestionnaire'),
        expect.stringContaining('rejet'),
        'console 1',
      ]);
    } finally {
      element.remove();
    }
  });

  test('sous monterApp, un console.error paraît dans erreurs()', async () => {
    erreursAdmises = true;
    const m = await monter();
    expect(m.erreurs()).toEqual([]);
    console.error('épreuve du collecteur');
    expect(m.erreurs()).toEqual([{ type: 'console.error', message: 'épreuve du collecteur' }]);
  });
});

describe('injection des plateformes (§ 13.4)', () => {
  test('deux événements au dossier : ni OPFS ni pont, et le montage n’écrit que la sonde du dossier retenu', async () => {
    const opfs = vi.spyOn(navigator.storage, 'getDirectory');
    const acces = [];
    const pont = new Proxy({}, {
      get(_cible, cle) {
        acces.push(String(cle));
        return undefined;
      },
    });
    window.gtt = pont;
    try {
      const m = await monter({
        fichiers: [fichier('bal', 'Bal des Grisailles'), fichier('club', 'Club des Merles', { texte: CONFLIT })],
      });
      expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(2);
      expect(opfs).not.toHaveBeenCalled();
      expect(acces).toEqual([]);
      expect(m.trace).toEqual([['sonder', 'documents', '']]);
    } finally {
      delete window.gtt;
    }
  });

  test('deux montages simultanés, chacun dans son conteneur, ne se mêlent pas', async () => {
    const a = await monter({ fichiers: [fichier('bal', 'Bal des Grisailles')] });
    const b = await monter({ fichiers: [fichier('club', 'Club des Merles', { texte: CONFLIT })] });
    expect(a.racine).not.toBe(b.racine);
    expect(a.fs).not.toBe(b.fs);
    expect(a.seance).not.toBe(b.seance);
    expect(a.racine.textContent).toContain('Bal des Grisailles');
    expect(b.racine.textContent).toContain('Club des Merles');
    expect(a.racine.textContent).not.toContain('Club des Merles');
    expect(b.racine.textContent).not.toContain('Bal des Grisailles');
    await a.seance.ouvrir('bal');
    flushSync();
    expect(libelleDeMode(a)).not.toBeNull();
    expect(libelleDeMode(b)).toBeNull();
    expect(b.seance.etat().evenement).toBeNull();
  });
});

describe('le montage d’épreuve', () => {
  test('aImporter : le dialogue rend chaque fichier, dans l’ordre, puis null ; les identifiants portent le rang du montage, distincts d’un montage à l’autre', async () => {
    const premier = { nom: 'invites.csv', octets: new Uint8Array([0x6e, 0x6f, 0x6d]) };
    const second = { nom: 'accueil.csv', octets: new Uint8Array([0x41]) };
    const a = await monter({ aImporter: [premier, second] });
    expect(await a.facade.choisirCsv()).toBe(premier);
    expect(await a.facade.choisirCsv()).toBe(second);
    expect(await a.facade.choisirCsv()).toBeNull();
    const b = await monter();
    expect(await b.facade.choisirCsv()).toBeNull();
    expect(a.seance.id).toMatch(/^epreuve-\d+-\d+$/);
    expect(b.seance.id).toMatch(/^epreuve-\d+-\d+$/);
    expect(a.seance.id.split('-')[1]).not.toBe(b.seance.id.split('-')[1]);
  });
});

describe('l’ordre du montage', () => {
  test('non publié, Documents non inscriptible : pret se résout, la façade rend sa question, la séance n’a pas de racine', async () => {
    const m = await monter({ systeme: { sonde: { documents: 'EROFS' } } });
    // Lu dès pret, avant tout appel de l'épreuve à la façade : la
    // détermination est celle qu'App a faite.
    expect(m.trace).toContainEqual(['sonder', 'documents', '']);
    expect(m.seance.etat().racine).toBeNull();
    expect(ecran(m)).not.toBeNull();
    const { dossier } = await m.facade.demarrer();
    expect(dossier.question?.code).toBe('DOCUMENTS_NON_INSCRIPTIBLE');
    expect(m.seance.etat().racine).toBeNull();
  });

  test('sans question : dès pret, la racine de la séance est celle du dossier retenu', async () => {
    const m = await monter();
    // Lu dès pret, avant tout appel de l'épreuve à la façade : la racine
    // est celle qu'App a fait poser.
    expect(m.trace).toEqual([['sonder', 'documents', '']]);
    const posee = m.seance.etat().racine;
    expect(posee?.id).toBe('documents');
    const { dossier } = await m.facade.demarrer();
    expect(dossier.question).toBeNull();
    expect(m.seance.etat().racine).toEqual(dossier.racine);
    expect(m.seance.etat().racine).toBe(posee);
  });

  test('sans question : dès pret, le premier écran porte la liste du dossier retenu', async () => {
    // Lu aussitôt après pret, sans attente : pret ne se résout qu'une fois
    // les lignes de la liste rendues.
    const m = await monter({
      fichiers: [fichier('bal', 'Bal des Grisailles'), fichier('club', 'Club des Merles', { texte: CONFLIT })],
    });
    const lignes = [...m.racine.querySelectorAll('[data-evenement]')];
    expect(lignes.length).toBe(2);
    expect(lignes.map((ligne) => ligne.dataset.evenement).sort()).toEqual(['bal', 'club']);
    expect(m.racine.textContent).toContain('Bal des Grisailles');
    expect(m.racine.textContent).toContain('Club des Merles');
  });

  test('Documents non inscriptible : dès pret, l’accueil est rendu sans aucune ligne, la question attend', async () => {
    const m = await monter({ systeme: { sonde: { documents: 'EROFS' } }, fichiers: [fichier('bal', 'Bal des Grisailles')] });
    expect(ecran(m)?.dataset.ecran).toBe('accueil');
    expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(0);
    expect(m.racine.querySelectorAll('[data-demonstration]').length).toBeGreaterThan(0);
    // Une lecture de la liste pendant que la question attend serait refusée
    // (QUESTION_EN_ATTENTE), et ce refus s'afficherait à la place des lignes.
    expect(dans(m, '[data-refus="accueil"]')).toBeNull();
  });

  test('Documents non inscriptible, « continuer » répondu : la liste est lue après la réponse, ses lignes rendues, sans refus', async () => {
    const m = await monter({ systeme: { sonde: { documents: 'EROFS' } }, fichiers: [fichier('bal', 'Bal des Grisailles')] });
    // Chaque lecture de la liste passe par la façade de ce montage ; une
    // lecture faite pendant que la question attend se voit à son refus.
    const issues = [];
    const lister = m.facade.lister;
    vi.spyOn(m.facade, 'lister').mockImplementation(async () => {
      try {
        const lues = await lister();
        issues.push('lue');
        return lues;
      } catch (erreur) {
        issues.push(erreur?.code ?? 'faute');
        throw erreur;
      }
    });
    await m.facade.repondre('continuer');
    await vi.waitFor(() => expect(m.racine.querySelectorAll('[data-evenement]').length).toBe(1));
    expect(dans(m, '[data-evenement]').dataset.evenement).toBe('bal');
    expect(dans(m, '[data-refus="accueil"]')).toBeNull();
    expect(issues).not.toContain('QUESTION_EN_ATTENTE');
    expect(issues).toContain('lue');
  });
});

describe('fermer sans question (§ 8.1, § 8.4, § 8.8)', () => {
  test('aucun écouteur beforeunload ; au pagehide, la séance se ferme et rend son verrou', async () => {
    const ecouteurs = vi.spyOn(window, 'addEventListener');
    const m = await avecEvenementOuvert();
    const poses = ecouteurs.mock.calls.map(([type]) => type);
    expect(poses).toContain('pagehide');
    expect(poses).not.toContain('beforeunload');
    await m.seance.passerEnEcriture();
    expect(verrouDe(m, 'bal')).not.toBeNull();
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false }));
    await vi.waitFor(() => expect(m.seance.etat().evenement).toBeNull());
    expect(verrouDe(m, 'bal')).toBeNull();
  });
});

describe('rendu du bandeau, dans les deux thèmes (§ 14.2, § 14.5)', () => {
  // Un événement ouvert en écriture : le bandeau porte alors tout ce qu'il
  // peut porter — libellé de mode, « Liste des événements », thèmes, « À
  // propos ».
  async function bandeauComplet() {
    const m = await avecEvenementOuvert();
    await m.seance.passerEnEcriture();
    flushSync();
    expect(libelleDeMode(m)).not.toBeNull();
    return m;
  }

  test('le bandeau et chacun de ses textes sont visibles dans la fenêtre', async () => {
    // Le texte, le titre et le style calculé se relisent sur un élément qui
    // ne peint rien. visible interroge donc la mise en page : checkVisibility,
    // une boîte non vide dans la fenêtre, et le centre de cette boîte qui
    // atteint l'élément ou l'un de ses descendants sans qu'un élément peint
    // au-dessus y peigne — un élément recouvert, ou rogné par un ancêtre,
    // échoue.
    const m = await bandeauComplet();
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        const porteurs = bandeauEtTextes(m);
        expect(porteurs.length).toBeGreaterThan(4);
        for (const porteur of porteurs) {
          expect(visible(porteur), `${theme} : ${designation(porteur)}`).toBe(true);
        }
      });
    }
  });

  test('le texte et le fond du bandeau ont une couleur calculée', async () => {
    const m = await bandeauComplet();
    const style = getComputedStyle(bandeau(m));
    expect(style.color).not.toBe(TRANSPARENT);
    expect(style.backgroundColor).not.toBe(TRANSPARENT);
  });

  test('chaque texte du bandeau tient 4,5:1 sur chaque couleur peinte sous lui', async () => {
    const m = await bandeauComplet();
    const couleursParTheme = [];
    for (const theme of THEMES) {
      const couleurs = await sousTheme(theme, () => {
        const textes = porteursDeTexte(bandeau(m));
        expect(textes.length).toBeGreaterThan(4);
        for (const porteur of textes) {
          const lieu = `${theme} : ${designation(porteur)}`;
          const texte = couleurTexte(porteur);
          const fonds = fondPeintSous(porteur);
          expect(fonds.length, `${lieu} : aucun fond opaque`).toBeGreaterThan(0);
          expect(texte[3], lieu).toBe(1);
          for (const fond of fonds) {
            expect(contraste(texte, fond), `${lieu} sur ${fond.join(', ')}`).toBeGreaterThanOrEqual(4.5);
          }
        }
        return [document.body, bandeau(m)].map((el) => {
          const style = getComputedStyle(el);
          return `${composantes(style.color)} sur ${composantes(style.backgroundColor)}`;
        });
      });
      couleursParTheme.push(couleurs);
    }
    // Un attribut que la feuille ne lit pas, ou un thème sombre qui ne
    // redéfinit aucune couleur, ferait mesurer deux fois le thème clair.
    expect(
      couleursParTheme[1],
      `mêmes couleurs dans les deux thèmes : ${couleursParTheme[0].join(' ; ')}`,
    ).not.toEqual(couleursParTheme[0]);
  });

  test('aucune opacité partielle, aucun filtre, masque ni mode de fusion sous un texte', async () => {
    // opacity et filter ne s'héritent pas : posés sur un ancêtre, ils changent
    // le pixel peint sans changer le style calculé du texte. attenuations
    // relit donc chaque niveau de l'ascendance, jusqu'à la racine du document.
    const m = await bandeauComplet();
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        const textes = porteursDeTexte(bandeau(m));
        expect(textes.length).toBeGreaterThan(4);
        for (const porteur of textes) {
          const fautes = attenuations(porteur).map(
            (f) => `${designation({ element: f.element, pseudo: f.pseudo })} ${f.propriete}: ${f.valeur}`,
          );
          expect(fautes, `${theme} : ${designation(porteur)}`).toEqual([]);
        }
      });
    }
  });
});

// La couleur qu'un jeton donne dans le thème courant, relue sur une sonde.
function jeton(nom) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${nom})`;
  document.body.append(sonde);
  const couleur = composantes(getComputedStyle(sonde).color);
  sonde.remove();
  return couleur;
}

// L'élément du bandeau dont le texte propre, blancs de bord ôtés, vaut texte.
const porteurDe = (racine, texte) =>
  [...racine.querySelectorAll('*')].find((e) => [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() === texte));

describe('le bandeau de la maquette (§ 8.4, § 18.6)', () => {
  test('la marque : un dessin caché aux technologies d’assistance, de la teinte de la marque, devant le nom ; la version et la provenance en pilules, de l’encre secondaire du bandeau', async () => {
    const m = await avecEvenementOuvert();
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        const dessin = bandeau(m).querySelector('svg');
        expect(dessin, theme).not.toBeNull();
        expect(dessin.getAttribute('aria-hidden'), theme).toBe('true');
        expect(visible(dessin), theme).toBe(true);
        expect(composantes(getComputedStyle(dessin).color), theme).toEqual(jeton('--couleur-bandeau-marque'));
        const nom = porteurDe(bandeau(m), t('coquille.nom'));
        expect(nom, theme).toBeDefined();
        expect(dessin.compareDocumentPosition(nom) & Node.DOCUMENT_POSITION_FOLLOWING, theme).toBeTruthy();
        expect(dessin.getBoundingClientRect().right, theme).toBeLessThanOrEqual(nom.getBoundingClientRect().left);
        for (const texte of [VERSION.affichee, libelleProvenance('test')]) {
          const pilule = porteurDe(bandeau(m), texte);
          const style = getComputedStyle(pilule);
          expect(composantes(style.color), `${theme} ${texte}`).toEqual(jeton('--couleur-bandeau-texte-secondaire'));
          expect(composantes(style.borderTopColor), `${theme} ${texte}`).toEqual(jeton('--couleur-bandeau-filet'));
          expect(Number.parseFloat(style.borderTopLeftRadius), `${theme} ${texte}`).toBeGreaterThanOrEqual(pilule.getBoundingClientRect().height / 2);
        }
      });
    }
  });

  test('les commandes du bandeau, dans l’ordre : « Liste des événements », « Paramètres », « À propos » ; aucun réglage de thème, qui vit dans « Paramètres »', async () => {
    const m = await avecEvenementOuvert();
    const commandes = [...bandeau(m).querySelectorAll('button')];
    expect(commandes.map((bouton) => bouton.dataset.commande)).toEqual(['liste', 'parametres', 'apropos']);
    expect(commandes.map((bouton) => bouton.textContent.trim())).toEqual([t('coquille.liste'), t('coquille.parametres.titre'), t('coquille.apropos.titre')]);
    const boites = commandes.map((bouton) => bouton.getBoundingClientRect());
    for (let rang = 1; rang < boites.length; rang += 1) {
      expect(boites[rang].top).toBe(boites[0].top);
      expect(boites[rang - 1].right).toBeLessThanOrEqual(boites[rang].left);
    }
    expect(bandeau(m).querySelector('[data-commande="theme"]')).toBeNull();
    expect(bandeau(m).querySelector(`[role="group"][aria-label="${t('coquille.theme.titre')}"]`)).toBeNull();
  });

  test('« Liste des événements » et « À propos » : une icône cachée devant le texte de « Liste des événements », le texte inchangé ; le libellé de mode en pilule, en gras', async () => {
    const m = await avecEvenementOuvert();
    const liste = dans(m, '[data-bandeau] [data-commande="liste"]');
    expect(liste.textContent.trim()).toBe(t('coquille.liste'));
    expect(liste.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(dans(m, '[data-bandeau] [data-commande="apropos"]').textContent.trim()).toBe(t('coquille.apropos.titre'));
    const mode = libelleDeMode(m);
    expect(getComputedStyle(mode).fontWeight).toBe('700');
    expect(Number.parseFloat(getComputedStyle(mode).borderTopLeftRadius)).toBeGreaterThanOrEqual(mode.getBoundingClientRect().height / 2);
  });

  test('le bandeau tient sur une ligne de 52 px au plus à 1 366 px de large, événement ouvert, et ne déborde pas à 1 024 px', async () => {
    const avant = { largeur: innerWidth, hauteur: innerHeight };
    try {
      await fixerCadre(1366, 700);
      const m = await avecEvenementOuvert();
      expect(bandeau(m).getBoundingClientRect().height).toBeLessThanOrEqual(52);
      await fixerCadre(1024, 700);
      flushSync();
      expect(bandeau(m).scrollWidth).toBeLessThanOrEqual(bandeau(m).clientWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(1024);
    } finally {
      await fixerCadre(avant.largeur, avant.hauteur);
    }
  });
});

describe('la page de la maquette : fond, largeur bornée, styles de base', () => {
  test('au-delà de la largeur de page, la liste se centre dans --largeur-page ; en deçà, elle prend la fenêtre ; l’événement prend la fenêtre à toute largeur', async () => {
    const avant = { largeur: innerWidth, hauteur: innerHeight };
    try {
      await fixerCadre(1800, 900);
      const m = await monter();
      const main = ecran(m).parentElement;
      expect(main.tagName.toLowerCase()).toBe('main');
      const boite = main.getBoundingClientRect();
      const borne = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) * 87;
      expect(boite.width).toBeCloseTo(borne, 0);
      expect(boite.left).toBeCloseTo((document.documentElement.clientWidth - boite.width) / 2, 0);
      await fixerCadre(1366, 700);
      flushSync();
      expect(main.getBoundingClientRect().width).toBeCloseTo(document.documentElement.clientWidth, 0);
      for (const largeur of [1800, 1366]) {
        await fixerCadre(largeur, 900);
        const ouvert = await avecEvenementOuvert();
        const principal = ecran(ouvert).parentElement;
        expect(ecran(ouvert).dataset.ecran, `${largeur}`).toBe('evenement');
        expect(principal.getBoundingClientRect().left, `${largeur}`).toBeCloseTo(0, 0);
        expect(principal.getBoundingClientRect().width, `${largeur}`).toBeCloseTo(document.documentElement.clientWidth, 0);
      }
    } finally {
      await fixerCadre(avant.largeur, avant.hauteur);
    }
  });

  test('un titre, un tableau et un champ sans style propre prennent les styles de base de l’écran ; le document imprimé les ignore', async () => {
    const m = await monter();
    const zone = document.createElement('div');
    zone.innerHTML = [
      '<h1>Titre témoin</h1>',
      '<table><thead><tr><th>En-tête</th></tr></thead><tbody><tr><td>12</td></tr></tbody></table>',
      '<input type="text" value="saisie">',
      '<div data-impression><table><thead><tr><th>Papier</th></tr></thead></table><input type="text" value="papier"></div>',
    ].join('');
    ecran(m).append(zone);
    try {
      for (const theme of THEMES) {
        await sousTheme(theme, () => {
          const [titre, th, td, champ] = ['h1', 'th', 'td', 'input'].map((s) => zone.querySelector(s));
          const racine = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
          expect(Number.parseFloat(getComputedStyle(titre).fontSize), theme).toBeCloseTo(racine * 1.875, 1);
          expect(getComputedStyle(th).textAlign, theme).toBe('start');
          expect(getComputedStyle(td).fontVariantNumeric, theme).toBe('tabular-nums');
          expect(composantes(getComputedStyle(champ).backgroundColor), theme).toEqual(jeton('--couleur-carte-fond'));
          expect(composantes(getComputedStyle(champ).borderTopColor), theme).toEqual(jeton('--couleur-page-filet'));
          expect(getComputedStyle(champ).borderTopLeftRadius, theme).toBe('8px');
          const papier = zone.querySelector('[data-impression]');
          expect(getComputedStyle(papier.querySelector('th')).textAlign, theme).not.toBe('start');
          expect(getComputedStyle(papier.querySelector('input')).borderTopLeftRadius, theme).not.toBe('8px');
        });
      }
    } finally {
      zone.remove();
    }
  });
});
