// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'import appliqué (§ 10.1) : ce que remplacer détruirait, à annoncer avant
// d'agir ; l'aperçu appliqué à une charge, selon le mode ; le CSV des lignes
// refusées, qui se corrige et se réimporte tel quel.
//
// appliquerImport n'agit que sur un plan qui n'est pas bloqué, et sur un
// aperçu sans refus global ni ambiguïté. Il rend une charge neuve, qui ne
// partage aucun objet avec celle qu'il reçoit : l'import entier tient dans
// une seule entrée d'historique, que la commande d'import écrit (§ 8.2). Les
// personnes ajoutées prennent leurs identifiants à partir de
// prochainsIds.participant, dans l'ordre du fichier, et le compteur ne recule
// jamais : un identifiant retiré ne revient pas (§ 4).
//
// Le CSV des refus reprend chaque ligne refusée telle que découpée, sous
// l'en-tête d'origine, et ajoute deux colonnes, ligne et motif, qu'aucun
// en-tête ne reconnaît : corrigé, il se réimporte sans qu'on en retire rien.
// Réimporté sans correction, il ne fait entrer aucune ligne que l'aperçu a
// refusée : chacune l'est de nouveau pour le même motif, sauf une ligne aux
// champs en trop parmi les vingt premiers enregistrements, qui fait refuser
// le texte entier, à son rang, par le choix du séparateur.

import { MODES, designer, indexerParNom } from './apercu.js';
import { ErreurCsv } from './erreurs.js';
import { SEPARATEUR, ecrireCsv } from './export.js';
import { enregistrementVide } from './lecture.js';

// Champs d'une ligne de l'aperçu, dans l'ordre du participant : ceux que
// porte une personne créée, et que pose une mise à jour quand la cellule
// n'est pas vide.
const CHAMPS_LUS = Object.freeze(['nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes', 'exclu']);

// En-têtes des deux colonnes qu'ajoute le CSV des refus, inconnues de
// l'association des colonnes.
const ENTETE_LIGNE = 'ligne';
const ENTETE_MOTIF = 'motif';

/**
 * Une ligne refusée, par l'aperçu ou par la mise à jour (§ 10.1). Le CSV des
 * refus en écrit une par ligne.
 *
 * @typedef {Object} LigneRefusee
 * @property {number} ligne          rang de l'enregistrement, en-tête compris
 * @property {string} code           CHAMPS_EN_TROP, NOM_ABSENT ou
 *           EXCLU_INCONNU, de l'aperçu ; PLUSIEURS_CORRESPONDENT ou
 *           DEJA_DESIGNE, de la mise à jour
 * @property {string|null} valeur    la valeur d'« exclu » refusée sous
 *           EXCLU_INCONNU, null sous tout autre code
 * @property {number[]} [participants]  refus de la mise à jour : les
 *           identifiants croissants que la ligne désigne
 * @property {number} [premiereLigne]   DEJA_DESIGNE : la ligne qui désigne
 *           ce participant la première
 * @property {string[]} brut         les champs tels que découpés
 *
 * @typedef {Object} ResumeImport
 * @property {number} ajoutes               participants créés
 * @property {number} misAJour              participants dont une valeur au
 *           moins a changé
 * @property {number} inchanges             participants désignés par une
 *           ligne qui ne change rien
 * @property {number} retires               participants retirés
 * @property {number} reservationsRetirees  leurs réservations
 * @property {LigneRefusee[]} refusees      rangées par ligne
 * @property {boolean} derive               vrai en état retenu
 */

const parLigne = (a, b) => a.ligne - b.ligne;

// Titres pourvus (§ 4.1, § 4.4). Un titre n'est pourvu que par la réservation
// d'une personne non exclue, sur sa place, à un tour au moins : la
// réservation d'une personne exclue est suspendue. La place se lit selon le
// réglage attribuerSieges (§ 2.1, étape 6). Vrai, c'est un siège : une
// réservation sans siège n'y pourvoit aucun titre. Faux, c'est la table, dont
// les titres ne se distinguent pas : à un tour donné, une table de k titres
// en a autant de pourvus que de personnes non exclues qui y sont réservées à
// ce tour, k au plus, et ses titres pourvus sont ceux du tour qui en pourvoit
// le plus.
function titresPourvus({ evenement, reglages, participants, reservations, titres }) {
  const presents = new Set(participants.filter(({ exclu }) => !exclu).map(({ id }) => id));
  const actives = reservations.filter(({ participant }) => presents.has(participant));
  if (reglages.attribuerSieges) {
    // Un titre porte toujours un siège : la place d'une réservation sans
    // siège, [table, null], n'est celle d'aucun titre.
    const place = (table, siege) => JSON.stringify([table, siege]);
    const occupees = new Set(actives.map(({ table, siege }) => place(table, siege)));
    return titres.filter(({ table, siege }) => occupees.has(place(table, siege))).length;
  }
  const titresParTable = new Map();
  for (const { table } of titres) titresParTable.set(table, (titresParTable.get(table) ?? 0) + 1);
  let pourvus = 0;
  for (const [table, nombre] of titresParTable) {
    let auMieux = 0;
    for (let tour = 1; tour <= evenement.tours; tour += 1) {
      const reserves = new Set(
        actives
          .filter((r) => r.table === table && (r.portee === 'tous' || r.tour === tour))
          .map(({ participant }) => participant),
      );
      auMieux = Math.max(auMieux, Math.min(nombre, reserves.size));
    }
    pourvus += auMieux;
  }
  return pourvus;
}

/**
 * Ce que remplacer détruirait, à annoncer avant d'agir (§ 10.1) : « 260
 * personnes seront supprimées » laisse croire qu'on ne perd que des noms.
 * Remplacer retire chaque participant et ses réservations ; il garde les
 * titres, qui appartiennent aux places, et les propositions, qui deviennent
 * périmées (§ 8.9). Le bilan compte :
 * - participants : les participants retirés, exclus compris ;
 * - reservations : leurs réservations, suspendues comprises, soit toutes :
 *   chaque réservation d'une charge que l'analyse admet est celle d'un
 *   participant ;
 * - titresPourvus : les titres qu'une réservation pourvoit, et que le
 *   remplacement laisse non pourvus — par la réservation d'une personne non
 *   exclue, sur son siège quand les sièges sont attribués, sur sa table
 *   sinon, à un tour au moins ;
 * - propositions : les propositions qui placent au moins une personne
 *   retirée. Le retenu n'y entre pas : l'import en état retenu porte
 *   l'avertissement de dérive.
 * La charge n'est pas modifiée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {{participants: number, reservations: number, titresPourvus: number, propositions: number}}
 */
export function bilanRemplacement(charge) {
  const retires = new Set(charge.participants.map(({ id }) => id));
  return {
    participants: charge.participants.length,
    reservations: charge.reservations.length,
    titresPourvus: titresPourvus(charge),
    propositions: charge.propositions.filter(({ participants }) => participants.some((id) => retires.has(id))).length,
  };
}

// Participant créé d'une ligne de l'aperçu, ses clés dans l'ordre du
// fichier d'état : un exclu vide vaut non.
const creer = (id, { nom, prenom, appartenance, courriel, titrePressenti, notes, exclu }) => ({
  id, nom, prenom, appartenance, courriel, titrePressenti, notes, exclu: exclu ?? false,
});

// Pose sur le participant chaque champ non vide de la ligne : un champ vide
// garde la valeur (§ 10.1). Rend vrai quand une valeur a changé.
function poser(participant, champs) {
  let change = false;
  for (const champ of CHAMPS_LUS) {
    if (champs[champ] !== null && champs[champ] !== participant[champ]) {
      participant[champ] = champs[champ];
      change = true;
    }
  }
  return change;
}

// Met à jour, en place, les participants que désignent les lignes, et rend
// les lignes à ajouter, les refus et les comptes. Chaque ligne désigne par
// designer, contre l'index des participants d'avant l'import : un
// participant ajouté par une ligne n'est désigné par aucune autre, et le
// prénom ou l'appartenance qu'une ligne pose n'écarte pas ce participant des
// candidats d'une suivante. Une ligne qui ne désigne personne est à ajouter.
// Une ligne qui en désigne plusieurs est refusée PLUSIEURS_CORRESPONDENT,
// jamais ajoutée. Le participant qu'une ligne désigne seule est mis à jour
// par la première de ces lignes, dans l'ordre du fichier ; chaque suivante
// est refusée DEJA_DESIGNE : deux lignes ne se fondent pas en silence dans
// une même personne.
function mettreAJour(participants, lignes) {
  const index = indexerParNom(participants);
  const parId = new Map(participants.map((participant) => [participant.id, participant]));
  const designes = new Map();
  const nouvelles = [];
  const refusees = [];
  let misAJour = 0;
  let inchanges = 0;
  for (const { ligne, champs, brut } of lignes) {
    const { candidats } = designer(champs, index);
    if (candidats.length === 0) {
      nouvelles.push({ champs });
      continue;
    }
    if (candidats.length > 1) {
      refusees.push({ ligne, code: 'PLUSIEURS_CORRESPONDENT', valeur: null, participants: candidats, brut: [...brut] });
      continue;
    }
    const [id] = candidats;
    if (designes.has(id)) {
      refusees.push({
        ligne, code: 'DEJA_DESIGNE', valeur: null, participants: [id], premiereLigne: designes.get(id),
        brut: [...brut],
      });
      continue;
    }
    designes.set(id, ligne);
    if (poser(parId.get(id), champs)) misAJour += 1;
    else inchanges += 1;
  }
  return { nouvelles, refusees, misAJour, inchanges };
}

/**
 * Applique un aperçu à une charge (§ 10.1), selon le mode :
 * - 'ajouter' : chaque ligne valide devient un participant ; un doublon ne se
 *   fusionne jamais ;
 * - 'mettreAJour' : une ligne désigne, par designer, les participants
 *   d'avant l'import de même nom normalisé ; le prénom et l'appartenance
 *   n'en écartent un que lorsque la ligne et lui en portent tous deux un,
 *   de clés normalisées différentes, selon leurs valeurs d'avant l'import.
 *   Une ligne ajoutée à côté d'un participant de même nom est celle que
 *   l'aperçu nomme dans homonymes. Désigné seul, le participant prend chaque champ non vide de
 *   la ligne, nom, prénom et appartenance compris, et garde la valeur d'un
 *   champ vide ; exclu vide le garde. Une ligne qui ne désigne personne est
 *   ajoutée ; qui en désigne plusieurs, refusée PLUSIEURS_CORRESPONDENT ; qui
 *   désigne un participant qu'une ligne précédente désigne déjà, refusée
 *   DEJA_DESIGNE ;
 * - 'remplacer' : les participants et leurs réservations sont retirés,
 *   puis chaque ligne valide ajoutée. Tables, titres, propositions et retenu
 *   restent (bilanRemplacement).
 * Une personne créée prend les champs de sa ligne, exclu vide valant non ;
 * les identifiants partent de prochainsIds.participant, dans l'ordre du
 * fichier, et le compteur avance d'autant. La charge et l'aperçu reçus ne
 * sont pas modifiés ; la charge rendue n'en partage aucun objet.
 *
 * Le résumé (ResumeImport) compte les participants ajoutés, mis à jour,
 * inchangés et retirés, et les réservations retirées. refusees porte les
 * lignes refusées par l'aperçu, puis par la mise à jour, rangées par ligne :
 * c'est la liste que reçoit exporterRefus. Chaque ligne valide est comptée
 * une fois : ajoutée, mise à jour, inchangée ou refusée. Une mise à jour dont
 * toutes les lignes sont refusées rend une charge égale à celle reçue.
 * derive est vrai en état retenu : l'import y avertit sans bloquer (§ 9).
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {import('./apercu.js').Apercu} apercu  calculé contre les
 *   participants de la charge, pour ce mode : hors de remplacer,
 *   l'appartenance d'une ligne y prend l'orthographe d'un existant de même
 *   clé ; en remplacer, celle du fichier
 * @param {'ajouter'|'mettreAJour'|'remplacer'} mode
 * @returns {{charge: import('../stockage/types.js').Charge, resume: ResumeImport}}
 * @throws {ErreurCsv} dans cet ordre : PLAN_BLOQUE, détails {}, en état
 *   bloqué ; le refus global de l'aperçu, son code, détails { ligne }, le rang
 *   que nomme l'aperçu ou null ; AMBIGUITE, détails { champs }, les champs
 *   que l'en-tête laisse ambigus, tant que le choix ne les tranche pas
 * @throws {TypeError} pour un mode inconnu, et pour un aperçu calculé pour un
 *   autre mode : l'aperçu montré à l'opérateur est celui que l'import
 *   applique
 */
export function appliquerImport(charge, apercu, mode) {
  if (!MODES.includes(mode)) throw new TypeError(`mode : ${MODES.join(', ')} attendu, reçu ${String(mode)}`);
  if (apercu.mode !== mode) throw new TypeError(`aperçu calculé pour ${String(apercu.mode)}, import en ${mode}`);
  if (charge.evenement.etat === 'bloque') throw new ErreurCsv('PLAN_BLOQUE');
  if (apercu.refusGlobal !== null) throw new ErreurCsv(apercu.refusGlobal, { ligne: apercu.refusGlobalLigne });
  const { ambigus } = apercu.association;
  if (ambigus.length > 0) throw new ErreurCsv('AMBIGUITE', { champs: ambigus.map(({ champ }) => champ) });

  const resultat = structuredClone(charge);
  let retires = 0;
  let reservationsRetirees = 0;
  let aAjouter = apercu.lignes;
  let suite = { refusees: [], misAJour: 0, inchanges: 0 };
  if (mode === 'remplacer') {
    retires = resultat.participants.length;
    reservationsRetirees = resultat.reservations.length;
    resultat.participants = [];
    resultat.reservations = [];
  } else if (mode === 'mettreAJour') {
    suite = mettreAJour(resultat.participants, apercu.lignes);
    aAjouter = suite.nouvelles;
  }
  for (const { champs } of aAjouter) {
    resultat.participants.push(creer(resultat.prochainsIds.participant, champs));
    resultat.prochainsIds.participant += 1;
  }
  return {
    charge: resultat,
    resume: {
      ajoutes: aAjouter.length,
      misAJour: suite.misAJour,
      inchanges: suite.inchanges,
      retires,
      reservationsRetirees,
      refusees: [...structuredClone(apercu.refusees), ...suite.refusees].sort(parLigne),
      derive: charge.evenement.etat === 'retenu',
    },
  };
}

/**
 * CSV des lignes refusées (§ 10.1, § 14.10), qui se corrige et se réimporte
 * tel quel. L'en-tête est celui d'origine, tel qu'écrit, suivi de ligne et
 * motif, deux en-têtes qu'aucun champ ne reconnaît. Chaque refus, rangé par
 * ligne, écrit ses cellules d'origine telles que découpées, complétées de
 * cellules vides jusqu'à la largeur de l'en-tête, puis son rang et son
 * motif : ligne et motif restent sous leur en-tête. Des cellules au-delà de
 * l'en-tête ne s'écrivent, après le motif, que lorsque l'une n'est pas
 * blanche — la ligne refusée CHAMPS_EN_TROP — : réimporté sans correction,
 * le fichier ne fait entrer aucune ligne décalée. UTF-8 avec marque, CRLF,
 * séparateur d'origine, « ; » pour un fichier à une colonne, qui n'en a pas ;
 * sans refus, l'en-tête seul.
 *
 * @param {import('./apercu.js').Apercu} apercu  ses en-têtes et son séparateur
 * @param {(code: string, details: Object) => string} motif  le texte d'un
 *   refus, de son code et de ses détails : la LigneRefusee sans code ni
 *   brut — ligne et valeur, plus participants et premiereLigne pour un refus
 *   de la mise à jour
 * @param {LigneRefusee[]} [refusees]  les refus à écrire : par défaut ceux
 *   de l'aperçu, sous un refus global comme sans ; après l'application,
 *   resume.refusees, qui porte aussi ceux de la mise à jour
 * @returns {Uint8Array}
 * @throws {TypeError} quand motif ne rend pas une chaîne
 */
export function exporterRefus(apercu, motif, refusees = apercu.refusees) {
  const largeur = apercu.entetes.length;
  const enregistrements = [[...apercu.entetes, ENTETE_LIGNE, ENTETE_MOTIF]];
  for (const { code, brut, ...details } of [...refusees].sort(parLigne)) {
    const texte = motif(code, details);
    if (typeof texte !== 'string') {
      throw new TypeError(`motif de ${code} : chaîne attendue, reçu ${JSON.stringify(texte) ?? String(texte)}`);
    }
    const cellules = brut.slice(0, largeur);
    while (cellules.length < largeur) cellules.push('');
    const auDela = brut.slice(largeur);
    enregistrements.push([...cellules, String(details.ligne), texte, ...(enregistrementVide(auDela) ? [] : auDela)]);
  }
  return ecrireCsv(enregistrements, apercu.separateur ?? SEPARATEUR);
}
