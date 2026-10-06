// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Lecture d'un texte CSV déjà décodé (§ 10.1, § 10.2) : sa découpe en
// enregistrements et le choix de son séparateur. L'import d'un fichier et le
// collage en bloc passent par ces mêmes fonctions : le texte qu'elles reçoivent
// n'a plus d'origine, et un second analyseur « simplifié » divergerait du
// premier sur les accents et les guillemets.

import { ErreurCsv } from './erreurs.js';

const GUILLEMET = '"';

// Candidats du séparateur, dans l'ordre qui départage deux candidats à égalité
// de tout le reste.
const CANDIDATS = [';', ',', '\t'];

// Nombre d'enregistrements que le choix du séparateur lit.
const FENETRE = 20;

// Parcourt texte en un seul passage et rend ses enregistrements, avec l'état
// des guillemets à la fin de la lecture. La lecture s'arrête après limite
// enregistrements terminés ; guillemetOuvert est alors faux, la lecture
// s'arrêtant hors d'un champ cité.
//
// La découpe suit RFC 4180, avec ces précisions :
// - un guillemet ouvre un champ cité quand il en est le premier caractère ;
//   ailleurs, c'est un caractère comme un autre ;
// - dans un champ cité, le séparateur et les fins de ligne font partie du
//   texte, deux guillemets font un guillemet, un seul referme le champ ; ce qui
//   suit le guillemet fermant, jusqu'au séparateur, reste dans le champ ;
// - CRLF, LF ou CR terminent un enregistrement, CRLF comptant pour une seule
//   fin ;
// - une ligne vide est un enregistrement d'un seul champ vide ; la ligne vide
//   qui suit la dernière fin de ligne ne fait pas d'enregistrement ;
// - un séparateur null ne sépare rien : chaque enregistrement est un champ ;
// - aucun blanc n'est retiré.
function analyser(texte, separateur, limite) {
  const enregistrements = [];
  let enregistrement = [];
  let champ = '';
  let cite = false;
  let debutDeChamp = true;
  let debutDeLigne = true;
  for (let i = 0; i < texte.length; i += 1) {
    const c = texte[i];
    if (cite) {
      if (c !== GUILLEMET) {
        champ += c;
      } else if (texte[i + 1] === GUILLEMET) {
        champ += GUILLEMET;
        i += 1;
      } else {
        cite = false;
      }
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && texte[i + 1] === '\n') i += 1;
      enregistrement.push(champ);
      enregistrements.push(enregistrement);
      if (enregistrements.length >= limite) return { enregistrements, guillemetOuvert: false };
      enregistrement = [];
      champ = '';
      debutDeChamp = true;
      debutDeLigne = true;
      continue;
    }
    debutDeLigne = false;
    if (c === separateur) {
      enregistrement.push(champ);
      champ = '';
      debutDeChamp = true;
    } else if (c === GUILLEMET && debutDeChamp) {
      cite = true;
    } else {
      champ += c;
      debutDeChamp = false;
    }
  }
  if (!debutDeLigne) {
    enregistrement.push(champ);
    enregistrements.push(enregistrement);
  }
  return { enregistrements, guillemetOuvert: cite };
}

/**
 * Découpe un texte en enregistrements de champs, selon RFC 4180 : champs cités,
 * guillemets doublés, séparateur et fins de ligne dans un champ cité, fins de
 * ligne CRLF, LF ou CR. Une ligne vide est un enregistrement d'un seul champ
 * vide ; la ligne vide qui suit la dernière fin de ligne ne fait pas
 * d'enregistrement. Aucun blanc n'est retiré des champs.
 *
 * Un enregistrement se désigne par son rang à partir de 1, l'en-tête compris :
 * le numéro de ligne qu'un tableur lui donne. Un champ cité sur plusieurs
 * lignes ne fait qu'un enregistrement ; la découpe ne rend aucun numéro de
 * ligne du texte.
 *
 * @param {string} texte
 * @param {string|null} separateur  un caractère, ou null pour un fichier à une
 *   colonne, dont chaque ligne est un seul champ
 * @returns {{ enregistrements: string[][], guillemetOuvert: boolean }}
 *   guillemetOuvert est vrai quand le texte s'achève dans un champ cité : le
 *   dernier enregistrement porte alors le texte lu jusque-là.
 */
export function decouper(texte, separateur) {
  return analyser(texte, separateur, Infinity);
}

/**
 * Vrai quand chaque champ de l'enregistrement est vide ou réduit à des blancs :
 * une ligne vide, une ligne de séparateurs seuls, une ligne de blancs. Le choix
 * du séparateur ne compte pas ces enregistrements.
 *
 * @param {string[]} enregistrement
 * @returns {boolean}
 */
export function enregistrementVide(enregistrement) {
  return enregistrement.every((champ) => champ.trim() === '');
}

// Lecture d'un texte par un candidat dans la fenêtre du choix. L'en-tête est
// le premier enregistrement non vide parmi ceux que la fenêtre termine : un
// guillemet resté ouvert court jusqu'à la fin du texte, et l'enregistrement
// où il s'ouvre, le dernier lu, reste inachevé. Rend null quand l'en-tête
// manque ou n'a qu'un champ : la constance seule ne suffit pas, et le candidat
// n'a pas de défaut à nommer. Sinon, rend le nombre d'en-têtes reconnus et le
// premier défaut qui écarte le candidat, ou null : un enregistrement non vide
// dont le nombre de champs diffère de celui de l'en-tête, à son rang ; à
// défaut, le guillemet resté ouvert, au rang où il s'ouvre.
function lireAvec(texte, candidat, reconnaitre) {
  const { enregistrements, guillemetOuvert } = analyser(texte, candidat, FENETRE);
  const termines = guillemetOuvert ? enregistrements.slice(0, -1) : enregistrements;
  const entete = termines.find((e) => !enregistrementVide(e));
  if (entete === undefined || entete.length < 2) return null;
  const ecart = termines.findIndex((e) => !enregistrementVide(e) && e.length !== entete.length);
  let defaut = null;
  if (ecart !== -1) defaut = { ligne: ecart + 1, cause: 'NOMBRE_DE_CHAMPS' };
  else if (guillemetOuvert) defaut = { ligne: enregistrements.length, cause: 'GUILLEMET_OUVERT' };
  return { separateur: candidat, reconnus: entete.filter((champ) => reconnaitre(champ)).length, defaut };
}

// La lecture qui l'emporte, de la meilleure jusqu'ici et d'une suivante dans
// l'ordre des candidats : celle qui reconnaît le plus d'en-têtes, la première
// à égalité.
const meilleure = (jusquIci, suivante) =>
  jusquIci === null || suivante.reconnus > jusquIci.reconnus ? suivante : jusquIci;

/**
 * Choisit le séparateur parmi « ; », « , » et la tabulation en lisant les vingt
 * premiers enregistrements avec chacun. Un candidat convient quand la lecture
 * s'achève sans guillemet ouvert et que les enregistrements non vides ont tous
 * le même nombre de champs, supérieur à 1 : sur un fichier séparé par des
 * virgules, « ; » donne lui aussi un nombre de champs constant, un seul, et la
 * constance ne suffit pas.
 *
 * À égalité, le candidat dont le premier enregistrement non vide compte le plus
 * d'en-têtes reconnus l'emporte ; à égalité encore, le premier dans l'ordre
 * « ; », « , », tabulation.
 *
 * Quand aucun candidat ne convient et que la première ligne entière, ses blancs
 * de bord retirés, est un en-tête reconnu, le fichier n'a qu'une colonne :
 * separateur est null, et un nom qui porte une virgule reste entier. Sinon,
 * ErreurCsv('SEPARATEUR_INTROUVABLE'), dont les détails nomment ce qui écarte
 * le candidat que le même départage désigne parmi ceux dont l'en-tête a au
 * moins deux champs : { separateur, ligne, cause }, ligne étant le rang de
 * l'enregistrement fautif et cause NOMBRE_DE_CHAMPS — le premier
 * enregistrement non vide dont le nombre de champs diffère de celui de
 * l'en-tête — ou GUILLEMET_OUVERT — sans écart, le guillemet resté ouvert,
 * au rang où il s'ouvre. Sans un tel candidat, les détails sont vides.
 *
 * @param {string} texte
 * @param {(entete: string) => unknown} reconnaitre  rend une valeur vraie pour
 *   un en-tête connu ; reçoit chaque champ du premier enregistrement non vide
 *   tel qu'il est écrit, ou la première ligne entière d'un fichier à une
 *   colonne, ses blancs de bord retirés
 * @returns {{ separateur: string|null }}
 * @throws {ErreurCsv} SEPARATEUR_INTROUVABLE, détails
 *   { separateur, ligne, cause } ou {}
 */
export function choisirSeparateur(texte, reconnaitre) {
  let retenu = null;
  let ecarte = null;
  for (const candidat of CANDIDATS) {
    const lecture = lireAvec(texte, candidat, reconnaitre);
    if (lecture === null) continue;
    if (lecture.defaut === null) retenu = meilleure(retenu, lecture);
    else ecarte = meilleure(ecarte, lecture);
  }
  if (retenu !== null) return { separateur: retenu.separateur };

  const premiere = analyser(texte, null, FENETRE).enregistrements.find((e) => !enregistrementVide(e));
  if (premiere !== undefined && reconnaitre(premiere[0].trim())) return { separateur: null };
  if (ecarte === null) throw new ErreurCsv('SEPARATEUR_INTROUVABLE');
  throw new ErreurCsv('SEPARATEUR_INTROUVABLE', { separateur: ecarte.separateur, ...ecarte.defaut });
}
