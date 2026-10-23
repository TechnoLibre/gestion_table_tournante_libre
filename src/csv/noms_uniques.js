// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// « Rendre les noms uniques » (§ 10.1) : le nom que reçoit chaque ligne d'un
// doublon de l'aperçu pour que l'import ne crée plus deux personnes de même
// triplet. Rien ne se fusionne : chaque ligne reste une personne, et seul
// son nom change. Le texte n'est jamais réécrit ; les noms rendus repassent
// par apercevoir (option noms), qui recalcule l'aperçu entier sur eux.
//
// Dans chaque doublon, le premier porteur du triplet garde son nom : la
// personne de l'événement quand le doublon en recoupe une, sinon la
// première ligne du fichier. Chaque autre ligne, dans l'ordre du fichier,
// reçoit au nom une espace et un numéro, « 01 », « 02 »… — deux chiffres,
// trois au-delà de 99 —, que le doublon suivant de même nom continue. Un nom
// suffixé que porte déjà, par sa clé normalisée, une personne de
// l'événement, une ligne du fichier, valide ou refusée, ou un nom déjà
// rendu, saute au numéro libre suivant.
//
// En mise à jour, une ligne que l'import applique à une personne existante
// (issuesDeMiseAJour la lui fait désigner seule) est cette personne, non un
// doublon : elle garde son nom, et le suffixe la rendrait à une création.
// Sous remplacer, qui retire chaque personne, l'événement ne compte pas.

import { issuesDeMiseAJour } from './apercu.js';
import { cleNormalisee } from './normalisation.js';

// Le numéro d'un suffixe : deux chiffres au moins.
const numero = (n) => String(n).padStart(2, '0');

// Les clés normalisées des noms que l'import laisserait côte à côte : ceux
// des personnes que le mode garde, des lignes valides, et des lignes
// refusées dont la cellule du nom n'est pas vide.
function nomsPris(apercu, existants) {
  const pris = new Set(existants.map(({ nom }) => cleNormalisee(nom)));
  for (const { champs } of apercu.lignes) pris.add(cleNormalisee(champs.nom));
  const rang = apercu.association.colonnes.nom;
  for (const { brut } of apercu.refusees) {
    const cellule = rang === undefined || rang >= brut.length ? '' : brut[rang].normalize('NFC').trim();
    if (cellule !== '') pris.add(cleNormalisee(cellule));
  }
  return pris;
}

// Les rangs des lignes qu'une mise à jour applique à une personne
// existante ; aucun dans les autres modes, où chaque ligne est créée.
function lignesMisesAJour(apercu, participants) {
  if (apercu.mode !== 'mettreAJour') return new Set();
  const issues = issuesDeMiseAJour(participants, apercu.lignes);
  return new Set(apercu.lignes.filter((_, rang) => Number.isInteger(issues[rang].id)).map(({ ligne }) => ligne));
}

/**
 * Les noms qui rendent uniques les doublons d'un aperçu de participants
 * (§ 10.1), à repasser à apercevoir par son option noms.
 *
 * @param {import('./apercu.js').Apercu} apercu  un aperçu de participants
 * @param {Array<{id: number, nom: string, prenom: string|null, organisation: string|null}>} [participants]
 *   les participants contre lesquels l'aperçu s'est calculé
 * @returns {Map<number, string>}  rang de ligne → nom rendu, dans l'ordre
 *   des doublons de l'aperçu puis de leurs lignes ; vide sans doublon à
 *   rendre, et sous un refus global
 */
export function rendreNomsUniques(apercu, participants = []) {
  const noms = new Map();
  if (apercu.refusGlobal !== null) return noms;
  const pris = nomsPris(apercu, apercu.mode === 'remplacer' ? [] : participants);
  const misesAJour = lignesMisesAJour(apercu, participants);
  const nomDe = new Map(apercu.lignes.map(({ ligne, champs }) => [ligne, champs.nom]));
  // Le prochain numéro à essayer, par clé normalisée du nom d'origine.
  const prochains = new Map();
  for (const doublon of apercu.doublons) {
    const aRendre = doublon.lignes.filter(
      (ligne, rang) => !misesAJour.has(ligne) && (doublon.existants.length > 0 || rang > 0),
    );
    for (const ligne of aRendre) {
      const nom = nomDe.get(ligne);
      const cle = cleNormalisee(nom);
      let n = prochains.get(cle) ?? 1;
      while (pris.has(cleNormalisee(`${nom} ${numero(n)}`))) n += 1;
      const rendu = `${nom} ${numero(n)}`;
      pris.add(cleNormalisee(rendu));
      prochains.set(cle, n + 1);
      noms.set(ligne, rendu);
    }
  }
  return noms;
}
