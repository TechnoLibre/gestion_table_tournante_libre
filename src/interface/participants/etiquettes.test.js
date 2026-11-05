// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle des étiquettes de la fiche (§ 4.5, § 10.2, § 5.9) : les
// pastilles, la commande que portent l'ajout et le retrait, la saisie qui
// reste après un ajout, et le signal d'orthographe gardé contre le champ.
// Les libellés de la fiche se composent ici. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { ajoutEtiquettes, etiquettesDeLaFiche, retraitEtiquette, saisieApresAjout, signauxOrthographe } from './etiquettes.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Une charge de deux personnes, la première étiquetée « finance ».
function chargeEssai() {
  let charge = creerCharge({ id: 'evt-grives', nom: 'Soirée des Grives', siegesParDefaut: 4, tours: 2 });
  for (const nom of ['Ombrelle', 'Pervenche']) charge = appliquerCommande('ajouterParticipant', charge, { champs: { nom } }).charge;
  return appliquerCommande('changerEtiquettes', charge, { id: 1, ajouter: 'finance' }).charge;
}

describe('etiquettesDeLaFiche : les pastilles de la fiche', () => {
  test('les étiquettes de la personne, dans l’ordre de la charge, en copie', () => {
    const participant = { id: 1, etiquettes: ['Montréal', 'finance'] };
    const pastilles = etiquettesDeLaFiche(participant);
    assert.deepEqual(pastilles, ['Montréal', 'finance']);
    pastilles.push('bénévole');
    assert.deepEqual(participant.etiquettes, ['Montréal', 'finance']);
  });

  test('sans le champ, aucune pastille', () => {
    assert.deepEqual(etiquettesDeLaFiche({ id: 2 }), []);
  });
});

describe('ajoutEtiquettes, retraitEtiquette : une seule commande, changerEtiquettes', () => {
  test('la saisie part entière, telle que tapée : la découpe et la forme sont celles de la commande', () => {
    assert.deepEqual(ajoutEtiquettes(3, ' finance ; Montréal|bénévole '), {
      nom: 'changerEtiquettes',
      args: { id: 3, ajouter: ' finance ; Montréal|bénévole ' },
    });
  });

  test('le retrait nomme l’étiquette par sa chaîne exacte', () => {
    assert.deepEqual(retraitEtiquette(3, 'Montréal'), { nom: 'changerEtiquettes', args: { id: 3, retirer: 'Montréal' } });
  });

  test('sur une charge, l’ajout pose les étiquettes reçues, le retrait les ôte', () => {
    const avant = chargeEssai();
    const { nom, args } = ajoutEtiquettes(2, 'FINANCE, ressources humaines');
    const rendu = appliquerCommande(nom, avant, args);
    assert.deepEqual(rendu.charge.participants[1].etiquettes, ['finance', 'ressources humaines']);
    const retrait = retraitEtiquette(2, 'finance');
    assert.deepEqual(appliquerCommande(retrait.nom, rendu.charge, retrait.args).charge.participants[1].etiquettes, ['ressources humaines']);
  });
});

describe('saisieApresAjout : ce que le champ garde après un ajout abouti', () => {
  test('la saisie envoyée, encore là, se vide ; une frappe pendant l’écriture reste', () => {
    assert.equal(saisieApresAjout('finance', 'finance'), '');
    assert.equal(saisieApresAjout('finance', 'finance, Mont'), 'finance, Mont');
    assert.equal(saisieApresAjout('finance', ''), '');
  });
});

describe('signauxOrthographe : le signal d’orthographe contre le champ (§ 4.5)', () => {
  const avertissements = [
    { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'FINANCE', retenue: 'finance' } },
    { code: 'PLACES_MANQUANTES', details: { manque: 1 } },
    { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'Bénévole', retenue: 'bénévole' } },
  ];
  const dernier = { revision: 7, participant: 3, avertissements };

  test('les orthographes retenues du dernier ajout, dans leur ordre, tant que sa révision est la courante et la fiche la même', () => {
    assert.deepEqual(signauxOrthographe(dernier, { revision: 7, participant: 3 }), [
      { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'FINANCE', retenue: 'finance' } },
      { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'Bénévole', retenue: 'bénévole' } },
    ]);
  });

  test('une autre révision, une autre personne, ou aucun ajout : aucun signal', () => {
    assert.deepEqual(signauxOrthographe(dernier, { revision: 8, participant: 3 }), []);
    assert.deepEqual(signauxOrthographe(dernier, { revision: 7, participant: 4 }), []);
    assert.deepEqual(signauxOrthographe(null, { revision: 7, participant: 3 }), []);
  });

  test('sur une charge : « FINANCE » saisi quand « finance » existe rend le signal, que le libellé dit', () => {
    const rendu = appliquerCommande('changerEtiquettes', chargeEssai(), { id: 2, ajouter: 'FINANCE' });
    const [signal] = signauxOrthographe({ revision: 1, participant: 2, avertissements: rendu.avertissements }, { revision: 1, participant: 2 });
    assert.deepEqual(signal, { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'FINANCE', retenue: 'finance' } });
    assert.match(t(signal.code, signal.details), /FINANCE.*finance/);
  });
});

describe('les libellés de la fiche', () => {
  test('la rubrique, le champ, l’ajout, le retrait nommé par l’étiquette, et la fiche sans étiquette', () => {
    assert.equal(t('participants.fiche.etiquettes'), 'Étiquettes');
    assert.equal(t('participants.fiche.aucuneEtiquette'), 'Aucune étiquette.');
    assert.equal(t('participants.etiquettes.champ'), 'Ajouter des étiquettes, séparées par une virgule');
    assert.equal(t('participants.etiquettes.ajouter'), 'Ajouter');
    assert.equal(t('participants.etiquettes.retirer', { motCle: 'Montréal' }), 'Retirer « Montréal »');
  });
});
