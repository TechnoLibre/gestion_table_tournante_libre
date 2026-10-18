// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les commandes nommées (§ 8.2) : toute modification d'un événement passe par
// l'une d'elles. Une commande est une fonction pure (charge, arguments) →
// { charge, libelle, avertissements } : la charge rendue est neuve, celle
// reçue ne change jamais ; le libellé est le texte français que le journal
// fige (libelles.js) ; les avertissements, { code, details }, disent ce que le
// geste emporte de plus que son effet, sans rien empêcher. Un refus lève
// ErreurCommande(code, details), où details.remede nomme le geste qui le lève,
// null quand il n'y en a pas ; une faute du code — un argument de forme
// fausse, un état ou un champ inconnus — lève TypeError. Aucune commande
// n'écrit, ne lit l'horloge ni ne tire un aléa : appliquerCommande date le
// placement de l'instant que la séance lui passe (§ 8.9).
//
// La saisie entre en NFC, ses blancs de bord retirés, une chaîne vide valant
// null (§ 10.2) ; la règle d'un champ est celle du schéma du fichier d'état,
// que document.js tient seul. Les identifiants viennent de prochainsIds, qui
// ne recule jamais : un identifiant retiré ne revient pas (§ 4, § 5.7). Un
// plan bloqué refuse toute commande, débloquer excepté (§ 9).
//
// Les états du plan (§ 9) : brouillon, proposé et retenu se posent par
// changerEtat sans rien détruire, proposé quand une proposition existe,
// retenu quand un placement est retenu ; bloqué se pose de chacun d'eux, et
// seul debloquer le lève, vers l'état que le contenu impose (etatDeduit). Une
// génération fait passer un brouillon à proposé ; retenir pose retenu ;
// effacer les propositions ramène un plan proposé sans retenu à brouillon ;
// garder les meilleures en laisse une au moins, et ne change pas l'état.
import { ErreurCsv } from '../csv/erreurs.js';
import { appliquerImport, bilanRemplacement } from '../csv/import.js';
import { appliquerImportObjectifs } from '../csv/objectifs.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { serialiserCharge } from '../stockage/canonique.js';
import { entreeDeCourse } from '../stockage/courses.js';
import { SCHEMA, clesRangees, creerCharge, etatDeduit, premiereFaute } from '../stockage/document.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { ETIQUETTES_MAX } from '../stockage/etiquettes.js';
import { estHorodatage } from '../stockage/journal.js';
import { courseVersFichier, fauteDeCourse, fautes, formeNommee, versFichier } from '../stockage/placements.js';
import { COMMANDES_MOBILIER } from './commandes_mobilier.js';
import { COMMANDES_PLACES } from './commandes_places.js';
import { recopierPlacement, recopierToursFiges, tourFigeDifferent } from './depart.js';
import { ErreurCommande, refus } from './erreurs.js';
import { evaluer, nettoyage } from './evaluation.js';
import { libelle } from './libelles.js';
import { avisObjectifs, etiquettesDeLEvenement, etiquettesRangees, recevoirEtiquettes } from './objectifs.js';
import { nomAffiche } from './personnes.js';
import { couvre, repartirSieges, reservationsActives } from './places.js';
import { controlerReintegration, leverRefus } from './pose.js';

// Le refus d'une commande vit dans erreurs.js, le nom affiché d'une personne
// dans personnes.js : les importateurs de ce module les y trouvent encore.
export { ErreurCommande, nomAffiche };

// Un avertissement : il n'empêche rien.
const avertissement = (code, details) => ({ code, details });

// Règles du schéma : celle d'un champ d'objet, puis celles de l'événement et
// d'un participant.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const CHARGE = regleDuChamp(SCHEMA, 'charge');
const EVENEMENT = regleDuChamp(CHARGE, 'evenement');
const PARTICIPANT = regleDuChamp(CHARGE, 'participants').element;
// Le plus grand identifiant qu'admet la règle : le compteur, qui la suit,
// n'aurait plus de valeur au-delà de lui.
const IDENTIFIANT_MAX = regleDuChamp(PARTICIPANT, 'id').max;

const ETATS = ['brouillon', 'propose', 'retenu', 'bloque'];

// Les champs de texte d'un participant que la saisie pose, dans l'ordre du
// fichier.
const CHAMPS_DE_SAISIE = ['nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes'];

// Une saisie de texte : en NFC, ses blancs de bord retirés, null quand il ne
// reste rien ; null et l'absence valent null.
function saisie(valeur, champ) {
  if (valeur === undefined || valeur === null) return null;
  if (typeof valeur !== 'string') {
    throw new TypeError(`${champ} : chaîne ou null attendue, reçu ${JSON.stringify(valeur)}`);
  }
  const texte = valeur.normalize('NFC').trim();
  return texte === '' ? null : texte;
}

// Les champs d'une saisie de participant : chaque champ de texte présent, lu
// par saisie, et exclu quand admisExclu, un booléen. Un champ inconnu, ou
// d'une autre sorte, est une faute du code.
function lireChamps(champs, { admisExclu }) {
  if (champs === null || typeof champs !== 'object' || Array.isArray(champs)) {
    throw new TypeError(`champs : objet attendu, reçu ${JSON.stringify(champs)}`);
  }
  const permis = admisExclu ? [...CHAMPS_DE_SAISIE, 'exclu'] : CHAMPS_DE_SAISIE;
  const inconnu = clesRangees(champs).find((cle) => !permis.includes(cle));
  if (inconnu !== undefined) throw new TypeError(`champs : ${inconnu} n'est pas un champ de cette saisie`);
  const lus = {};
  for (const champ of CHAMPS_DE_SAISIE) if (Object.hasOwn(champs, champ)) lus[champ] = saisie(champs[champ], champ);
  if (Object.hasOwn(champs, 'exclu')) {
    if (typeof champs.exclu !== 'boolean') {
      throw new TypeError(`exclu : booléen attendu, reçu ${JSON.stringify(champs.exclu)}`);
    }
    lus.exclu = champs.exclu;
  }
  return lus;
}

// Un participant tel que la saisie le pose : nom requis (NOM_REQUIS) ; toute
// autre valeur hors de sa règle est une faute du code.
function exigerParticipant(participant) {
  if (premiereFaute(participant.nom, regleDuChamp(PARTICIPANT, 'nom')) !== null) throw refus('NOM_REQUIS');
  const faute = premiereFaute(participant, PARTICIPANT);
  if (faute !== null) throw new TypeError(`participant : ${faute} hors de sa règle`);
}

// Le participant d'identifiant id, ou PARTICIPANT_INCONNU.
function participantDe(charge, id) {
  if (!Number.isSafeInteger(id)) throw new TypeError(`id : entier attendu, reçu ${JSON.stringify(id)}`);
  const participant = charge.participants.find((candidat) => candidat.id === id);
  if (participant === undefined) throw refus('PARTICIPANT_INCONNU', { id });
  return participant;
}

// Un plan bloqué refuse toute modification ; débloquer seul le lève (§ 9).
function exigerModifiable(charge) {
  if (charge.evenement.etat === 'bloque') throw refus('PLAN_BLOQUE', {}, { geste: 'debloquer' });
}

// Titres de place pourvus (§ 4.1, § 4.4) : le compte que bilanRemplacement
// tient pour l'import, seule implémentation de la règle (§ 13.2).
const titresPourvus = (charge) => bilanRemplacement(charge).titresPourvus;

// La charge reçue, copiée, son participant id remplacé par ce que rend
// modifier de sa copie.
function avecParticipant(charge, id, modifier) {
  const suivante = structuredClone(charge);
  suivante.participants = suivante.participants.map((participant) =>
    participant.id === id ? modifier(participant) : participant,
  );
  return suivante;
}

// La charge reçue, copiée, à l'état donné.
function avecEtat(charge, etat) {
  const suivante = structuredClone(charge);
  suivante.evenement.etat = etat;
  return suivante;
}

/** ajouterParticipant {champs} : seul le nom est requis ; exclu vaut faux par défaut. */
function ajouterParticipant(charge, { champs }) {
  exigerModifiable(charge);
  const lus = lireChamps(champs, { admisExclu: true });
  const id = charge.prochainsIds.participant;
  const participant = {
    id,
    nom: lus.nom ?? null,
    prenom: lus.prenom ?? null,
    appartenance: lus.appartenance ?? null,
    courriel: lus.courriel ?? null,
    titrePressenti: lus.titrePressenti ?? null,
    notes: lus.notes ?? null,
    exclu: lus.exclu ?? false,
  };
  exigerParticipant(participant);
  if (id >= IDENTIFIANT_MAX) throw refus('COMPTEUR_SATURE', { compteur: 'participant' });
  const suivante = structuredClone(charge);
  suivante.participants.push(participant);
  suivante.prochainsIds.participant = id + 1;
  return {
    charge: suivante,
    libelle: libelle('ENTREE_AJOUTER_PARTICIPANT', { personne: nomAffiche(participant) }),
    avertissements: [],
  };
}

/**
 * modifierParticipant {id, champs} : les champs de texte donnés ; l'exclusion
 * a ses deux commandes. Le libellé nomme la personne d'avant et chaque champ
 * changé, puis le nouveau nom quand il change.
 */
function modifierParticipant(charge, { id, champs }) {
  exigerModifiable(charge);
  const avant = participantDe(charge, id);
  const apres = { ...avant, ...lireChamps(champs, { admisExclu: false }) };
  exigerParticipant(apres);
  const changes = CHAMPS_DE_SAISIE.filter((champ) => apres[champ] !== avant[champ]);
  if (changes.length === 0) throw refus('SANS_EFFET', { commande: 'modifierParticipant' });
  const renomme = apres.nom !== avant.nom || apres.prenom !== avant.prenom;
  return {
    charge: avecParticipant(charge, id, () => apres),
    libelle: libelle('ENTREE_MODIFIER_PARTICIPANT', {
      personne: nomAffiche(avant),
      champs: changes,
      devenu: renomme ? nomAffiche(apres) : null,
    }),
    avertissements: [],
  };
}

// Une chaîne, ou undefined pour un argument absent ; une autre valeur est une
// faute du code.
function texteOuAbsent(valeur, nom) {
  if (valeur !== undefined && typeof valeur !== 'string') {
    throw new TypeError(`${nom} : chaîne attendue, reçu ${JSON.stringify(valeur)}`);
  }
  return valeur;
}

/**
 * changerEtiquettes {id, ajouter?, retirer?} (§ 4.5, § 5.9) : retirer, une
 * étiquette que la personne porte, s'ôte d'abord ; puis ajouter, une saisie
 * de une ou plusieurs étiquettes, se reçoit (recevoirEtiquettes) sur les
 * étiquettes de l'événement entier, personnes et objectifs, telles que le
 * retrait les laisse : une personne seule à porter une orthographe la
 * change ainsi en un geste. L'effet se juge par comparaison d'ensembles :
 * une liste qui garde les mêmes étiquettes est SANS_EFFET, quel que soit
 * l'ordre de la saisie. La liste s'écrit triée par unités de code, et le
 * champ se retire quand elle se vide. Refus : ETIQUETTE_INVALIDE {valeur,
 * raison} pour un morceau fautif, ou pour une saisie qui ne donne aucune
 * étiquette (raison 'vide') ; ETIQUETTES_EN_TROP {nombre} au-delà
 * d'ETIQUETTES_MAX ; remède null : la saisie se corrige dans le champ même.
 * Avertissements : ORTHOGRAPHE_RETENUE {saisie, retenue}. Ni ajouter ni
 * retirer, ou l'un d'eux qui n'est pas une chaîne, est une faute du code.
 */
function changerEtiquettes(charge, { id, ajouter, retirer } = {}) {
  exigerModifiable(charge);
  texteOuAbsent(ajouter, 'ajouter');
  texteOuAbsent(retirer, 'retirer');
  if (ajouter === undefined && retirer === undefined) throw new TypeError('changerEtiquettes : ajouter ou retirer attendu');
  const participant = participantDe(charge, id);
  const avant = participant.etiquettes ?? [];
  const gardees = avant.filter((motCle) => motCle !== retirer);
  let recues = { etiquettes: [], avertissements: [] };
  if (ajouter !== undefined) {
    const restante = avecParticipant(charge, id, (copie) => ({ ...copie, etiquettes: gardees }));
    recues = recevoirEtiquettes(etiquettesDeLEvenement(restante), ajouter);
    if (recues.etiquettes.length === 0) throw refus('ETIQUETTE_INVALIDE', { valeur: '', raison: 'vide' });
  }
  const apres = etiquettesRangees(new Set([...gardees, ...recues.etiquettes]));
  const ajoutees = apres.filter((motCle) => !avant.includes(motCle));
  const retirees = avant.filter((motCle) => !apres.includes(motCle));
  if (ajoutees.length === 0 && retirees.length === 0) throw refus('SANS_EFFET', { commande: 'changerEtiquettes' });
  if (apres.length > ETIQUETTES_MAX) throw refus('ETIQUETTES_EN_TROP', { nombre: apres.length });
  const suivante = avecParticipant(charge, id, (copie) => {
    const reste = { ...copie };
    delete reste.etiquettes;
    return apres.length === 0 ? reste : { ...reste, etiquettes: apres };
  });
  return {
    charge: suivante,
    libelle: libelle('ENTREE_CHANGER_ETIQUETTES', { personne: nomAffiche(participant), ajoutees, retirees }),
    avertissements: recues.avertissements,
  };
}

// Les comptes d'une exclusion ou d'une réintégration (§ 4.4) : les
// réservations de la personne, que l'exclusion suspend sans les retirer, et
// les titres que le geste cesse de pourvoir, ou pourvoit de nouveau.
function bilanExclusion(avant, apres, participant) {
  const reservations = avant.reservations.filter((reservation) => reservation.participant === participant.id).length;
  const titres = Math.abs(titresPourvus(avant) - titresPourvus(apres));
  return { participant: participant.id, personne: nomAffiche(participant), reservations, titres };
}

/**
 * exclureParticipant {id} (§ 4.4) : ses réservations restent, suspendues ; ses
 * places reviennent aux autres et ses titres ne sont plus pourvus, ce que
 * RESERVATIONS_SUSPENDUES dit quand il en porte.
 */
function exclureParticipant(charge, { id }) {
  exigerModifiable(charge);
  const participant = participantDe(charge, id);
  if (participant.exclu) throw refus('SANS_EFFET', { commande: 'exclureParticipant' });
  const suivante = avecParticipant(charge, id, (copie) => ({ ...copie, exclu: true }));
  const bilan = bilanExclusion(charge, suivante, participant);
  return {
    charge: suivante,
    libelle: libelle('ENTREE_EXCLURE_PARTICIPANT', { personne: bilan.personne }),
    avertissements: bilan.reservations > 0 ? [avertissement('RESERVATIONS_SUSPENDUES', bilan)] : [],
  };
}

/**
 * reintegrerParticipant {id} (§ 4.4) : ses réservations et ses titres
 * reviennent, RESERVATIONS_RETABLIES. Ses réservations suspendues se
 * contrôlent comme une pose (controlerReintegration, § 5.9) : le premier
 * refus se lève, SURRESERVATION ou PLACE_RESERVEE, les suivants dans
 * details.autres.
 */
function reintegrerParticipant(charge, { id }) {
  exigerModifiable(charge);
  const participant = participantDe(charge, id);
  if (!participant.exclu) throw refus('SANS_EFFET', { commande: 'reintegrerParticipant' });
  leverRefus(controlerReintegration(charge, id));
  const suivante = avecParticipant(charge, id, (copie) => ({ ...copie, exclu: false }));
  const bilan = bilanExclusion(charge, suivante, participant);
  return {
    charge: suivante,
    libelle: libelle('ENTREE_REINTEGRER_PARTICIPANT', { personne: bilan.personne }),
    avertissements: bilan.reservations > 0 ? [avertissement('RESERVATIONS_RETABLIES', bilan)] : [],
  };
}

/**
 * supprimerParticipant {id} : la personne et ses réservations partent dans la
 * même entrée ; les titres restent à leurs places, les propositions et le
 * retenu restent, en dérive (§ 9) ; le compteur ne recule pas.
 */
function supprimerParticipant(charge, { id }) {
  exigerModifiable(charge);
  const participant = participantDe(charge, id);
  const suivante = structuredClone(charge);
  suivante.participants = suivante.participants.filter((candidat) => candidat.id !== id);
  suivante.reservations = suivante.reservations.filter((reservation) => reservation.participant !== id);
  const reservations = charge.reservations.length - suivante.reservations.length;
  const details = {
    participant: id,
    personne: nomAffiche(participant),
    reservations,
    titres: titresPourvus(charge) - titresPourvus(suivante),
  };
  return {
    charge: suivante,
    libelle: libelle('ENTREE_SUPPRIMER_PARTICIPANT', { personne: details.personne }),
    avertissements: reservations > 0 ? [avertissement('RESERVATIONS_RETIREES', details)] : [],
  };
}

// Les avertissements de chaque personne qu'un import exclut ou réintègre
// (§ 4.4) : celle que la charge suivante porte sous le même identifiant,
// exclu changé, et qui tient une réservation. Chacune a le bilan que
// donnerait sa commande seule, exclureParticipant ou reintegrerParticipant,
// appliquée à la charge d'avant : RESERVATIONS_SUSPENDUES ou
// RESERVATIONS_RETABLIES, par identifiant croissant.
function avertissementsDExclusion(avant, suivante) {
  const exclusDApres = new Map(suivante.participants.map(({ id, exclu }) => [id, exclu]));
  return avant.participants
    .filter(({ id, exclu }) => exclusDApres.has(id) && exclusDApres.get(id) !== exclu)
    .sort((a, b) => a.id - b.id)
    .map((participant) => {
      const seule = avecParticipant(avant, participant.id, (copie) => ({ ...copie, exclu: !copie.exclu }));
      const code = participant.exclu ? 'RESERVATIONS_RETABLIES' : 'RESERVATIONS_SUSPENDUES';
      return avertissement(code, bilanExclusion(avant, seule, participant));
    })
    .filter(({ details }) => details.reservations > 0);
}

/**
 * importerParticipants {apercu, mode} (§ 10.1) : l'aperçu appliqué selon le
 * mode (appliquerImport), en une seule entrée. Le refus du CSV — un aperçu
 * refusé ou ambigu — devient le refus de la commande, sous le même code. Le
 * résumé suit le rendu, pour le rapport d'import et le CSV des refus. Selon
 * l'état : sans avertissement en brouillon et proposé ; en retenu,
 * l'avertissement de dérive IMPORT_EN_RETENU, quel que soit le mode, sur le
 * signal resume.derive d'appliquerImport ; refusé en bloqué, PLAN_BLOQUE.
 * Une personne que l'import exclut ou réintègre le dit ensuite comme sa
 * commande le dirait (avertissementsDExclusion).
 *
 * Un import dont la charge ne change pas, mais qui refuse des lignes, n'est
 * pas sans effet : ses refus sont à lire et à réexporter. Il rend la charge
 * reçue, un libellé null — aucune entrée ne s'écrit —, aucun avertissement,
 * et son résumé.
 */
function importerParticipants(charge, { apercu, mode }) {
  exigerModifiable(charge);
  let resultat;
  try {
    resultat = appliquerImport(charge, apercu, mode);
  } catch (erreur) {
    if (erreur instanceof ErreurCsv) throw new ErreurCommande(erreur.code, { ...erreur.details, remede: null });
    throw erreur;
  }
  const { ajoutes, misAJour, retires, derive, refusees } = resultat.resume;
  if (refusees.length > 0 && serialiserCharge(resultat.charge) === serialiserCharge(charge)) {
    return { charge, libelle: null, avertissements: [], resume: resultat.resume };
  }
  return {
    charge: resultat.charge,
    libelle: libelle('ENTREE_IMPORTER_PARTICIPANTS', { mode, ajoutes, misAJour, retires }),
    avertissements: [
      ...(derive ? [avertissement('IMPORT_EN_RETENU', {})] : []),
      ...avertissementsDExclusion(charge, resultat.charge),
    ],
    resume: resultat.resume,
  };
}

// Le remède d'un refus du CSV des objectifs, par code : un événement sans
// table se corrige dans la section des tables ; les autres se corrigent dans
// le fichier ou l'association des colonnes, et n'en ont pas.
const REMEDES_DES_OBJECTIFS = new Map([['OBJECTIFS_SANS_TABLE', { geste: 'ouvrirSection', section: 'tables' }]]);

/**
 * importerObjectifs {apercu, mode} (§ 10.4) : l'aperçu du CSV des objectifs
 * appliqué selon le mode, mettreAJour ou remplacer (appliquerImportObjectifs),
 * en une seule entrée. Le refus du CSV — un aperçu refusé ou ambigu — devient
 * le refus de la commande, sous le même code, remède null sauf OBJECTIFS_SANS_TABLE,
 * qui mène à la section des tables. Le résumé suit le rendu, pour le rapport
 * d'import et le CSV des refus. Selon l'état : sans avertissement en
 * brouillon et proposé ; en retenu, IMPORT_OBJECTIFS_RECLASSE, le classement
 * des propositions pouvant changer, sans qu'aucune passe en dérive (§ 8.9) ;
 * refusé en bloqué, PLAN_BLOQUE. Suivent, dans l'ordre d'avisObjectifs, les
 * avis OBJECTIF_SANS_CORRESPONDANT des seuls objectifs que le fichier écrit.
 *
 * Un import dont la charge ne change pas, mais qui refuse des lignes, rend la
 * charge reçue, un libellé null — aucune entrée ne s'écrit —, aucun
 * avertissement, et son résumé.
 */
function importerObjectifs(charge, { apercu, mode }) {
  exigerModifiable(charge);
  let resultat;
  try {
    resultat = appliquerImportObjectifs(charge, apercu, mode);
  } catch (erreur) {
    if (erreur instanceof ErreurCsv) {
      throw new ErreurCommande(erreur.code, { ...erreur.details, remede: REMEDES_DES_OBJECTIFS.get(erreur.code) ?? null });
    }
    throw erreur;
  }
  const { ajoutes, remplaces, retires, derive, refusees } = resultat.resume;
  if (refusees.length > 0 && serialiserCharge(resultat.charge) === serialiserCharge(charge)) {
    return { charge, libelle: null, avertissements: [], resume: resultat.resume };
  }
  const ecrits = new Set(apercu.lignes.map(({ champs }) => JSON.stringify([champs.table, champs.tour])));
  const sansCorrespondant = avisObjectifs(resultat.charge).filter(
    ({ code, details }) => code === 'OBJECTIF_SANS_CORRESPONDANT' && ecrits.has(JSON.stringify([details.table, details.tour])),
  );
  return {
    charge: resultat.charge,
    libelle: libelle('ENTREE_IMPORTER_OBJECTIFS', { mode, ajoutes, remplaces, retires }),
    avertissements: [...(derive ? [avertissement('IMPORT_OBJECTIFS_RECLASSE', {})] : []), ...sansCorrespondant],
    resume: resultat.resume,
  };
}

/** changerEtat {etat} (§ 9) : un état du plan, sans rien détruire ; bloque se pose de chacun. */
function changerEtat(charge, { etat }) {
  if (!ETATS.includes(etat)) throw new TypeError(`etat : ${ETATS.join(', ')} attendu, reçu ${JSON.stringify(etat)}`);
  exigerModifiable(charge);
  if (etat === charge.evenement.etat) throw refus('SANS_EFFET', { commande: 'changerEtat' });
  if (etat === 'propose' && charge.propositions.length === 0) {
    throw refus('AUCUNE_PROPOSITION', {}, { geste: 'ouvrirSection', section: 'generation' });
  }
  if (etat === 'retenu' && charge.retenu === null) {
    throw refus('AUCUN_RETENU', {}, { geste: 'ouvrirSection', section: 'propositions' });
  }
  return { charge: avecEtat(charge, etat), libelle: libelle('ENTREE_CHANGER_ETAT', { etat }), avertissements: [] };
}

/** debloquer {} (§ 8.5, § 9) : l'état revient à celui que le contenu impose. */
function debloquer(charge) {
  if (charge.evenement.etat !== 'bloque') throw refus('PLAN_NON_BLOQUE');
  const etat = etatDeduit(charge);
  return { charge: avecEtat(charge, etat), libelle: libelle('ENTREE_DEBLOQUER', { etat }), avertissements: [] };
}

// Le plan du moteur rangé par siège quand les sièges sont attribués (§ 4,
// § 5.3, § 8.9) : chaque liste de table de chaque tour par repartirSieges —
// la personne que sa réservation active, à un siège, couvrant ce tour à
// cette table, y prend ce rang —, les null de fin retirés. Le moteur ignore
// les sièges : sans ce rangement, la liste garde l'ordre du moteur,
// croissant par identifiant. Les places sont celles de la configuration sur
// laquelle le moteur a calculé, qui n'assied jamais plus : une table réduite
// ou supprimée depuis ne change pas le rangement, et la proposition
// s'enregistre avec sa dérive.
function rangerParSiege(charge, plan, configuration) {
  const places = new Map(configuration.tables.map(({ id, capacite: sieges }) => [id, sieges]));
  const assises = reservationsActives(charge).filter(({ siege }) => siege !== null);
  return {
    ...plan,
    tours: plan.tours.map((listes, rang) =>
      listes.map((liste, i) => {
        const idTable = plan.tables[i];
        const siegeDe = new Map();
        for (const reservation of assises) {
          if (reservation.table === idTable && couvre(reservation, rang + 1) && !siegeDe.has(reservation.participant)) {
            siegeDe.set(reservation.participant, reservation.siege);
          }
        }
        const rangee = repartirSieges(liste, siegeDe, places.get(idTable) ?? 0);
        while (rangee.length > 0 && rangee.at(-1) === null) rangee.pop();
        return rangee;
      }),
    ),
  };
}

// Le fichier et la course d'une proposition dérivée, dont les tours figés
// reprennent ceux du départ (§ 5.7, D72), dans cet ordre : le fichier qui
// porte la dérivation (versFichier), recopié du départ (recopierToursFiges),
// puis la course mise en forme sous lui ; sous sièges attribués des deux
// côtés, chaque point de relevé recopié à son tour, depuis le placement du
// fichier recopié, qui range ses listes dans l'ordre de ses tables, et la
// course contrôlée de nouveau. Chaque tour figé du fichier et de chaque
// point de relevé se compare à celui du départ (tourFigeDifferent) deux
// fois : par ensemble d'occupants, sur le placement que le moteur a rendu,
// avant toute recopie, qui sinon effacerait l'écart ; puis tel qu'il est
// enregistré, après elle. Un écart est une violation d'invariant, que la
// recherche partie du départ ne produit pas, refusée TOUR_FIGE_DIFFERENT
// {rang, tour}, rang étant l'identifiant du moteur. Le premier contrôle
// porte seul ce refus. Le second est une garde de la recopie, qu'aucune
// entrée de cette commande n'atteint : hors sièges attribués des deux
// côtés, la recopie rend les listes telles quelles et il refait la
// comparaison par ensemble ; sous eux, il ne vérifie que ce que
// recopierToursFiges et recopierPlacement écrivent, seule une recopie
// fautive le lève. Rend {fichier, course}, course null quand le moteur n'en
// rapporte pas.
function deriveeVersFichier(rangee, configuration, options, derivation, fichierDuDepart) {
  const { toursFiges } = derivation;
  const exigerToursFiges = (fichierLu, placement) => {
    const tour = tourFigeDifferent({ ...fichierLu, placement }, fichierDuDepart, toursFiges);
    if (tour !== null) throw refus('TOUR_FIGE_DIFFERENT', { rang: rangee.id, tour });
  };
  const rendu = versFichier(rangee, configuration, { ...options, derivation });
  // siegesAttribues faux : la comparaison par ensemble, qui ne lit ni l'ordre
  // des listes ni les chaises vides, que la recopie fixe ensuite.
  const enEnsemble = { ...rendu, siegesAttribues: false };
  exigerToursFiges(enEnsemble, rendu.placement);
  const fichier = recopierToursFiges(rendu, fichierDuDepart, toursFiges);
  let course = courseVersFichier(rangee, fichier, options);
  for (const { placement } of course === null ? [] : course.releves) exigerToursFiges(enEnsemble, placement);
  if (course !== null && fichier.siegesAttribues && fichierDuDepart.siegesAttribues) {
    course = {
      ...course,
      releves: course.releves.map(({ mouvements, placement }) => ({
        mouvements,
        placement: recopierPlacement(placement, fichier.placement, toursFiges),
      })),
    };
    const faute = fauteDeCourse(fichier, course);
    if (faute !== null) {
      throw new TypeError(`enregistrerGeneration : course recopiée fautive ${JSON.stringify({ chemin: faute })}`);
    }
  }
  const releves = course === null ? [] : course.releves;
  const placements = [fichier.placement, ...releves.map(({ placement }) => placement)];
  // Garde de la recopie, comparée dans l'ordre sous sièges attribués des
  // deux côtés : elle ne se lève que sur une recopie fautive.
  for (const placement of placements) exigerToursFiges(fichier, placement);
  return { fichier, course };
}

// La dérivation reçue, null ou {depart, toursFiges} : depart, un identifiant
// entier ; toursFiges, une liste, que versFichier contrôle ensuite. Toute
// autre forme est une faute du code.
function exigerDerivation(derivation) {
  const lisible =
    derivation === null ||
    (typeof derivation === 'object' && Number.isSafeInteger(derivation.depart) && Array.isArray(derivation.toursFiges));
  if (!lisible) {
    throw new TypeError(`derivation : {depart, toursFiges} ou null attendue, reçu ${JSON.stringify(derivation)}`);
  }
}

/**
 * enregistrerGeneration {propositions, configuration, produitVersion,
 * derivation = null} (§ 5.7, § 8.9) : les propositions du moteur, mises en
 * forme de fichier (versFichier) sous les identifiants qui suivent
 * prochainsIds.proposition — la proposition d'identifiant k du moteur prend
 * prochainsIds.proposition + k − 1 —, s'ajoutent aux précédentes, et le
 * compteur passe au-delà de la dernière. Sièges attribués, chaque liste se
 * range d'abord par siège (rangerParSiege), celles du plan de la proposition
 * et celles du plan de chacun de ses points de relevé : un placement de
 * relevé a ainsi la forme d'un placement de proposition, chaises vides et
 * sièges réservés compris. Un brouillon passe à proposé.
 *
 * Sous derivation {depart, toursFiges} — une génération dérivée, depart
 * l'identifiant de fichier de son départ —, chaque proposition porte depart
 * et toursFiges (versFichier), et ses tours figés reprennent ceux du départ,
 * plan et points de relevé (deriveeVersFichier) : les listes d'un tour figé
 * sont celles du départ, jamais rangées de nouveau. Un départ absent de la
 * charge est refusé PROPOSITION_INCONNUE {id}, avant toute mise en forme ;
 * un tour figé qui diffère du départ, TOUR_FIGE_DIFFERENT {rang, tour}. Le
 * libellé est alors ENTREE_ENREGISTRER_GENERATION_DERIVEE. Sans derivation,
 * ou sous null, la génération ordinaire, rien de plus.
 *
 * La course que le moteur rapporte de chaque proposition (§ 5.10) n'entre
 * pas dans la charge : le rendu la porte à côté, courses, l'entrée du
 * compagnon des courses de chaque proposition qui en rapporte une, dans
 * l'ordre des propositions (courseVersFichier, entreeDeCourse). L'entrée se
 * prend sur le fichier enregistré, tours figés recopiés : son empreinte est
 * celle que cleDeCourse calcule à la relecture. Le dépôt l'écrit dans le
 * compagnon, après l'état (§ 8.9). Les champs que le moteur ajoute à une
 * proposition, relances compris, n'entrent ni au fichier ni à la course.
 */
function enregistrerGeneration(charge, { propositions, configuration, produitVersion, derivation = null }) {
  exigerModifiable(charge);
  if (!Array.isArray(propositions)) throw new TypeError('propositions : liste attendue');
  exigerDerivation(derivation);
  if (propositions.length === 0) throw refus('SANS_EFFET', { commande: 'enregistrerGeneration' });
  const rangs = propositions.map(({ id }) => id);
  if (!rangs.every((id) => Number.isSafeInteger(id) && id >= 1) || new Set(rangs).size !== rangs.length) {
    throw new TypeError('propositions : identifiants du moteur entiers, ≥ 1 et distincts attendus');
  }
  const fichierDuDepart = derivation === null ? null : charge.propositions.find(({ id }) => id === derivation.depart);
  if (fichierDuDepart === undefined) throw refus('PROPOSITION_INCONNUE', { id: derivation.depart });
  const decalage = charge.prochainsIds.proposition - 1;
  const options = { produitVersion, attribuerSieges: charge.reglages.attribuerSieges, decalage };
  const fichiers = [];
  const courses = [];
  try {
    for (const proposition of propositions) {
      let rangee = proposition;
      if (options.attribuerSieges) {
        const ranger = (plan) => rangerParSiege(charge, plan, configuration);
        rangee = { ...proposition, plan: ranger(proposition.plan) };
        if (Array.isArray(proposition.releves)) {
          rangee.releves = proposition.releves.map((releve) => ({ ...releve, plan: ranger(releve.plan) }));
        }
      }
      const { fichier, course } =
        derivation === null
          ? sansDerivation(rangee, configuration, options)
          : deriveeVersFichier(rangee, configuration, options, derivation, fichierDuDepart);
      fichiers.push(fichier);
      if (course !== null) courses.push(entreeDeCourse(fichier, course));
    }
  } catch (erreur) {
    if (erreur instanceof ErreurStockage && erreur.code === 'COMPTEUR_SATURE') {
      throw refus('COMPTEUR_SATURE', erreur.details);
    }
    throw erreur;
  }
  const ids = fichiers.map(({ id }) => id);
  const premier = Math.min(...ids);
  const dernier = Math.max(...ids);
  const suivante = structuredClone(charge);
  suivante.propositions.push(...fichiers);
  suivante.prochainsIds.proposition = dernier + 1;
  if (suivante.evenement.etat === 'brouillon') suivante.evenement.etat = 'propose';
  const n = fichiers.length;
  return {
    charge: suivante,
    libelle:
      derivation === null
        ? libelle('ENTREE_ENREGISTRER_GENERATION', { n, premier, dernier })
        : libelle('ENTREE_ENREGISTRER_GENERATION_DERIVEE', {
            n,
            premier,
            dernier,
            depart: derivation.depart,
            toursFiges: derivation.toursFiges,
          }),
    avertissements: [],
    courses,
  };
}

// Le fichier et la course d'une proposition ordinaire : versFichier, puis la
// course mise en forme sous ce fichier.
function sansDerivation(rangee, configuration, options) {
  const fichier = versFichier(rangee, configuration, options);
  return { fichier, course: courseVersFichier(rangee, fichier, options) };
}

/**
 * retenirProposition {id} (§ 5.7, § 9) : le placement de la proposition,
 * copié, devient le retenu, que les retouches modifieront sans toucher la
 * proposition ; le plan passe à retenu.
 */
function retenirProposition(charge, { id }) {
  exigerModifiable(charge);
  const proposition = charge.propositions.find((candidate) => candidate.id === id);
  if (proposition === undefined) throw refus('PROPOSITION_INCONNUE', { id });
  const { siegesAttribues, tables, capacites, tours, participants, placement } = structuredClone(proposition);
  const suivante = avecEtat(charge, 'retenu');
  suivante.retenu = { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
  return { charge: suivante, libelle: libelle('ENTREE_RETENIR_PROPOSITION', { id }), avertissements: [] };
}

/**
 * effacerPropositions {} (§ 5.7) : la liste se vide, la proposition d'où vient
 * le retenu exceptée ; le compteur ne recule pas. Un plan proposé sans retenu
 * revient à brouillon.
 */
function effacerPropositions(charge) {
  exigerModifiable(charge);
  const origine = charge.retenu?.proposition ?? null;
  const gardees = charge.propositions.filter(({ id }) => id === origine);
  const n = charge.propositions.length - gardees.length;
  if (n === 0) throw refus('SANS_EFFET', { commande: 'effacerPropositions' });
  const suivante = structuredClone(charge);
  suivante.propositions = suivante.propositions.filter(({ id }) => id === origine);
  if (suivante.retenu === null && suivante.evenement.etat === 'propose') suivante.evenement.etat = 'brouillon';
  return {
    charge: suivante,
    libelle: libelle('ENTREE_EFFACER_PROPOSITIONS', { n, gardee: gardees.length > 0 ? origine : null }),
    avertissements: [],
  };
}

/**
 * garderMeilleures {n} (§ 5.7) : les n premières propositions du classement
 * unique, celles que le tableau montre en tête, restent, et celle d'où vient
 * le retenu avec elles ; les autres s'effacent. Le partage est celui de
 * nettoyage, sur la table d'evaluer de la charge reçue : la mesure qui
 * classe le tableau, refaite ici, puisque la commande ne lit que sa charge.
 * Les gardées restent dans l'ordre du fichier ; le compteur ne recule pas,
 * et l'état ne change pas, une proposition au moins restant. Rien à
 * effacer : SANS_EFFET. Une configuration qui ne se normalise pas ne se
 * classe pas : son refus, du code de normaliser, remède nul. n ne s'écrit
 * pas dans la charge : le libellé seul le nomme. Le résumé rendu,
 * {effacees}, compte les propositions que cette exécution efface : l'annonce
 * de l'écran le lit, plutôt que l'écart de deux lectures de la séance entre
 * lesquelles une autre écriture de la file peut passer.
 */
function garderMeilleures(charge, { n }) {
  exigerModifiable(charge);
  let table;
  try {
    table = evaluer(charge);
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) throw refus(erreur.code, erreur.details);
    throw erreur;
  }
  const { gardees, effacees, origineEnPlus } = nettoyage(table, n);
  if (effacees.length === 0) throw refus('SANS_EFFET', { commande: 'garderMeilleures' });
  const restent = new Set(gardees);
  const suivante = structuredClone(charge);
  suivante.propositions = suivante.propositions.filter(({ id }) => restent.has(id));
  return {
    charge: suivante,
    libelle: libelle('ENTREE_GARDER_MEILLEURES', { n, effacees: effacees.length, gardee: origineEnPlus }),
    avertissements: [],
    resume: { effacees: effacees.length },
  };
}

/**
 * Un registre réuni de plusieurs : chaque nom une fois, dans l'ordre des
 * registres reçus, puis de chacun.
 *
 * @param {...Map<string, Function>} registres
 * @returns {Map<string, Function>}
 * @throws {RangeError} un nom porté par deux registres, qu'il nomme
 */
export function reunirCommandes(...registres) {
  const reunies = new Map();
  for (const registre of registres) {
    for (const [nom, commande] of registre) {
      if (reunies.has(nom)) throw new RangeError(`commandes : ${JSON.stringify(nom)} est dans deux registres`);
      reunies.set(nom, commande);
    }
  }
  return reunies;
}

/**
 * Le registre des commandes, par nom : chacune (charge, arguments) →
 * { charge, libelle, avertissements }, et importerParticipants et
 * importerObjectifs y ajoutent le résumé de l'import, enregistrerGeneration
 * les courses de ses propositions. Il réunit les commandes de ce module,
 * celles du mobilier et celles des places.
 *
 * @typedef {{code: string, details: Object}} Avertissement
 * @typedef {{charge: Object, libelle: string, avertissements: Avertissement[]}} Rendu
 * @type {Map<string, (charge: Object, args: Object) => Rendu>}
 */
export const COMMANDES = reunirCommandes(
  new Map([
    ['ajouterParticipant', ajouterParticipant],
    ['modifierParticipant', modifierParticipant],
    ['changerEtiquettes', changerEtiquettes],
    ['exclureParticipant', exclureParticipant],
    ['reintegrerParticipant', reintegrerParticipant],
    ['supprimerParticipant', supprimerParticipant],
    ['importerParticipants', importerParticipants],
    ['importerObjectifs', importerObjectifs],
    ['changerEtat', changerEtat],
    ['debloquer', debloquer],
    ['enregistrerGeneration', enregistrerGeneration],
    ['retenirProposition', retenirProposition],
    ['effacerPropositions', effacerPropositions],
    ['garderMeilleures', garderMeilleures],
  ]),
  COMMANDES_MOBILIER,
  COMMANDES_PLACES,
);

// Le retenu sans son horodatage : une copie de premier niveau, que la
// comparaison des placements lit sans le modifier.
function sansHorodatage(retenu) {
  const { horodatage, ...reste } = retenu;
  return reste;
}

// Le texte canonique du retenu, horodatage retiré, sous une charge vidée de
// tout le reste : deux retenus de même texte décrivent le même placement,
// quel que soit l'ordre de leurs clés ou des listes que la canonisation
// range. La copie canonique d'un retenu ne lit que lui.
const VIDE = { participants: [], tables: [], reservations: [], titres: [], propositions: [] };
const texteDuPlacement = (charge, retenu) => serialiserCharge({ ...charge, ...VIDE, retenu: sansHorodatage(retenu) });

// Les entrées de courses d'une génération, refaites sur les propositions de
// la charge datée : chacune prend l'horodatage que dater a posé sur sa
// proposition, qui entre dans son identité (cleDeCourse). Chaque entrée
// est celle d'une proposition de la charge.
function daterCourses(charge, courses) {
  const parId = new Map(charge.propositions.map((p) => [p.id, p]));
  return courses.map(({ id, course }) => entreeDeCourse(parId.get(id), course));
}

// La charge rendue datée de horodatage (§ 8.9) : le retenu quand retenuNeuf,
// et chaque proposition dont l'identifiant manque à la charge reçue. Les
// objets datés sont neufs : ni la charge rendue ni la reçue ne changent.
function dater(recue, rendue, horodatage, retenuNeuf) {
  const anciennes = new Set(recue.propositions.map(({ id }) => id));
  return {
    ...rendue,
    propositions: rendue.propositions.map((p) => (anciennes.has(p.id) ? p : { ...p, horodatage })),
    retenu: retenuNeuf ? { ...rendue.retenu, horodatage } : rendue.retenu,
  };
}

/**
 * Applique la commande nom à la charge : ce qu'elle rend, avertissements []
 * quand elle n'en donne pas. Un geste dont la charge rendue s'écrit comme la
 * charge reçue ne change rien, et n'est pas une entrée (§ 8.2) : SANS_EFFET.
 * Un rendu au libellé null ne change rien non plus, mais porte ce qu'il y a
 * à lire — l'import dont seules des lignes refusées auraient changé la
 * liste : il passe tel quel, et rien ne s'écrit.
 *
 * horodatage, l'instant du geste que la séance lit à son horloge, date le
 * placement (§ 8.9, § 11.8). Un retenu que la commande rend inchangé à
 * l'horodatage près garde celui du reçu, présent ou absent, même quand elle
 * l'a reconstruit sans lui ; SANS_EFFET se juge ensuite, avant toute
 * datation : un geste sans effet ne le devient pas par son instant. Puis le
 * retenu qui change, ou qui apparaît, prend horodatage, et chaque proposition
 * dont l'identifiant manque à la charge reçue aussi ; les autres gardent le
 * leur. Les entrées de courses d'une génération (courses) prennent
 * l'horodatage de leur proposition, qui entre dans leur identité
 * (cleDeCourse). Corriger un nom ne date rien : l'horodatage date le
 * placement, non la page. horodatage null, le défaut, ne pose ni ne retire
 * rien : un retenu reconstruit à l'identique garde l'horodatage reçu, aucun
 * autre n'est posé, et les entrées de courses restent sans horodatage.
 *
 * @param {string} nom
 * @param {Object} charge
 * @param {Object} [args]
 * @param {{horodatage?: string|null}} [options]   horodatage de la forme
 *        d'estHorodatage, ou null
 * @returns {{charge: Object, libelle: string|null, avertissements: Array<{code: string, details: Object}>}}
 * @throws {ErreurCommande} le refus de la commande, ou SANS_EFFET
 * @throws {TypeError} une commande inconnue, un argument de forme fausse, un
 *         horodatage ni null ni de la forme d'estHorodatage
 */
export function appliquerCommande(nom, charge, args = {}, { horodatage = null } = {}) {
  const commande = COMMANDES.get(nom);
  if (commande === undefined) throw new TypeError(`commande inconnue : ${JSON.stringify(nom)}`);
  if (horodatage !== null && !estHorodatage(horodatage)) {
    throw new TypeError(`horodatage : AAAA-MM-JJTHH:MM:SS±HH:MM ou null attendu, reçu ${JSON.stringify(horodatage)}`);
  }
  const rendu = commande(charge, args ?? {});
  if (rendu.libelle === null) return { ...rendu, avertissements: rendu.avertissements ?? [] };
  let suivante = rendu.charge;
  const { retenu } = suivante;
  const memePlacement =
    retenu !== null &&
    charge.retenu !== null &&
    texteDuPlacement(charge, charge.retenu) === texteDuPlacement(charge, retenu);
  if (memePlacement) {
    const { horodatage: recu } = charge.retenu;
    suivante = { ...suivante, retenu: recu === undefined ? sansHorodatage(retenu) : { ...sansHorodatage(retenu), horodatage: recu } };
  }
  if (serialiserCharge(suivante) === serialiserCharge(charge)) throw refus('SANS_EFFET', { commande: nom });
  if (horodatage === null) return { ...rendu, charge: suivante, avertissements: rendu.avertissements ?? [] };
  suivante = dater(charge, suivante, horodatage, retenu !== null && !memePlacement);
  const courses = rendu.courses === undefined ? {} : { courses: daterCourses(suivante, rendu.courses) };
  return { ...rendu, charge: suivante, ...courses, avertissements: rendu.avertissements ?? [] };
}

/**
 * La forme nommée d'un placement de la charge (§ 8.9, point 4), pour la
 * lecture et le signalement d'un défaut : une lecture, ni commande ni
 * entrée. cible désigne { proposition: id } ou { retenu: true }. Rend
 * { lignes, fautes } : fautes, celles que le placement porte (fautes) ;
 * lignes, sa forme nommée (formeNommee), une ligne par identifiant écrit,
 * ou null quand sa forme est fausse (faute FORME), qui ne se lit pas en
 * lignes. Une proposition fautive n'est plus dans la charge qu'examiner
 * rend ; le retenu y reste, fautif ou non. La charge n'est pas modifiée.
 *
 * @param {Object} charge
 * @param {{proposition: number}|{retenu: true}} cible
 * @returns {{lignes: Array<Object>|null, fautes: Array<Object>}}
 * @throws {ErreurCommande} PROPOSITION_INCONNUE {id} ; AUCUN_RETENU, remède
 *         la section des propositions
 * @throws {TypeError} une cible d'une autre forme
 */
export function formeNommeeDe(charge, cible) {
  const cles = cible !== null && typeof cible === 'object' ? clesRangees(cible) : null;
  let placement;
  if (cles?.length === 1 && cles[0] === 'proposition' && Number.isSafeInteger(cible.proposition)) {
    placement = charge.propositions.find(({ id }) => id === cible.proposition);
    if (placement === undefined) throw refus('PROPOSITION_INCONNUE', { id: cible.proposition });
  } else if (cles?.length === 1 && cles[0] === 'retenu' && cible.retenu === true) {
    placement = charge.retenu;
    if (placement === null) throw refus('AUCUN_RETENU', {}, { geste: 'ouvrirSection', section: 'propositions' });
  } else {
    throw new TypeError(`cible : {proposition: id} ou {retenu: true} attendu, reçu ${JSON.stringify(cible)}`);
  }
  const lues = fautes(placement);
  const lisible = !lues.some(({ code }) => code === 'FORME');
  return { lignes: lisible ? formeNommee(placement, charge) : null, fautes: lues };
}

/** Le nombre de caractères le plus grand qu'admet le nom d'un événement
 *  saisi — créé, copié ou renommé (§ 8.1). Le fichier lu n'est pas borné :
 *  un nom plus long s'ouvre, et seule son impression se refuse (§ 11.7). */
export const NOM_EVENEMENT_MAX = 200;

/**
 * Le refus d'un nom d'événement trop long (§ 8.1) : NOM_EVENEMENT_TROP_LONG
 * {longueur, maximum} quand le nom, en NFC et ses blancs de bord retirés,
 * compte plus de NOM_EVENEMENT_MAX caractères ; null sinon. Un caractère est
 * un point de code : un caractère hors du plan de base compte pour un, une
 * lettre et son accent combinant, que NFC ne compose pas, pour deux. Le nom
 * n'est jamais tronqué.
 *
 * @param {string} nom
 * @param {Object|null} [remede]   celui que l'appelant offre, null sans lui
 * @returns {ErreurCommande|null}
 * @throws {TypeError} un nom qui n'est pas une chaîne
 */
export function refusNomEvenement(nom, remede = null) {
  if (typeof nom !== 'string') throw new TypeError(`nom : chaîne attendue, reçu ${JSON.stringify(nom)}`);
  const longueur = [...nom.normalize('NFC').trim()].length;
  if (longueur <= NOM_EVENEMENT_MAX) return null;
  return refus('NOM_EVENEMENT_TROP_LONG', { longueur, maximum: NOM_EVENEMENT_MAX }, remede);
}

/**
 * La charge d'un événement neuf (§ 8.1) et le libellé de sa création. Chaque
 * champ se contrôle selon sa règle avant que l'identifiant ne se tire :
 * NOM_REQUIS, NOM_EVENEMENT_TROP_LONG {longueur, maximum} (refusNomEvenement),
 * DATE_INVALIDE {date}, SIEGES_INVALIDES {sieges}, TOURS_INVALIDES {tours}.
 * Le nom entre en NFC, ses blancs de bord retirés ; une date vide vaut null.
 *
 * @param {{nom: string, date?: string|null, siegesParDefaut: number, tours: number}} evenement
 * @param {() => string} identifiant  tiré une fois, après les contrôles
 * @returns {{charge: Object, libelle: string}}
 * @throws {ErreurCommande}
 */
export function chargeNeuve({ nom, date = null, siegesParDefaut, tours }, identifiant) {
  const regle = (cle) => regleDuChamp(EVENEMENT, cle);
  const nomLu = saisie(nom, 'nom');
  const dateLue = saisie(date, 'date');
  if (premiereFaute(nomLu, regle('nom')) !== null) throw refus('NOM_REQUIS');
  const tropLong = refusNomEvenement(nomLu);
  if (tropLong !== null) throw tropLong;
  if (premiereFaute(dateLue, regle('date')) !== null) throw refus('DATE_INVALIDE', { date });
  if (premiereFaute(siegesParDefaut, regle('siegesParDefaut')) !== null) {
    throw refus('SIEGES_INVALIDES', { sieges: siegesParDefaut });
  }
  if (premiereFaute(tours, regle('tours')) !== null) throw refus('TOURS_INVALIDES', { tours });
  const charge = creerCharge({ id: identifiant(), nom: nomLu, date: dateLue, siegesParDefaut, tours });
  return { charge, libelle: libelle('ENTREE_CREATION', { nom: nomLu }) };
}
