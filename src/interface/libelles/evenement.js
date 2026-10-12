// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de l'événement ouvert : son en-tête et son résumé chiffré,
// ses états, la bande de mode et la place fixe de sa barre, les phases de
// sa navigation, l'attente d'une section chargée à part, la reprise d'un
// verrou, ses avertissements, le support rompu (§ 8.3 à § 8.9, § 9,
// § 14.6). Chaque clé commence par « evenement. ». Une donnée qui
// désigne — un numéro, une séance, un instant, une date — n'entre dans
// aucun de ces textes : l'écran la pose dans son propre nœud, à côté. Les
// comptes du résumé, eux, entrent dans le leur, qui s'accorde au nombre et
// l'écrit par creerFormat.
import { creerFormat } from '../../application/format.js';
import { cite } from '../../application/libelles/aides.js';

// Un compte en chiffres, par le format de la traduction, suivi de son nom au
// singulier jusqu'à un, au pluriel au-delà.
const compteEcrit = (n, singulier, pluriel, texte) => `${creerFormat(texte).nombre(n)} ${n <= 1 ? singulier : pluriel}`;

export const TABLE = new Map([
  // --- L'en-tête et les états du plan (§ 9) -----------------------------------
  ['evenement.etat.titre', 'État du plan'],
  ['evenement.etat.brouillon', 'Brouillon'],
  ['evenement.etat.propose', 'Proposé'],
  ['evenement.etat.retenu', 'Retenu'],
  ['evenement.etat.bloque', 'Bloqué'],

  // --- Le résumé chiffré de l'en-tête ------------------------------------------
  ['evenement.resume.participants', ({ participants }, texte) => compteEcrit(participants, 'participant', 'participants', texte)],
  [
    'evenement.resume.tables',
    ({ tables, sieges }, texte) =>
      `${compteEcrit(tables, 'table', 'tables', texte)} \u{00B7} ${compteEcrit(sieges, 'siège', 'sièges', texte)}`,
  ],
  ['evenement.resume.tours', ({ tours }, texte) => compteEcrit(tours, 'tour', 'tours', texte)],

  // --- La bande de mode, sous le bandeau (§ 8.4, § 8.5) ------------------------
  // Chaque phrase cite la commande qui sort du mode par son propre libellé,
  // sauf lectureSeule : devant un format plus récent, la place fixe n'offre
  // aucune commande (§ 8.8), et la phrase n'en nomme aucune.
  ['evenement.bande.lecture', (_, texte) => `Rien ne change ; ${cite(texte('communs.commande.modifier'))} passe en écriture.`],
  [
    'evenement.bande.ecriture',
    (_, texte) => `Chaque geste s\u{2019}enregistre aussitôt ; ${cite(texte('communs.commande.lecture'))} arrête l\u{2019}écriture.`,
  ],
  [
    'evenement.bande.bloque',
    (_, texte) => `Rien ne change tant que le plan est bloqué ; ${cite(texte('communs.commande.debloquer'))} le rouvre.`,
  ],
  ['evenement.bande.lectureSeule', 'Rien ne change ; ce fichier ne s\u{2019}ouvre qu\u{2019}en lecture.'],

  // --- Les phases de la navigation des sections ---------------------------------
  ['evenement.phase.preparer', 'Préparer'],
  ['evenement.phase.placer', 'Placer'],
  ['evenement.phase.produire', 'Produire'],

  // --- Une section chargée à part (SectionDifferee.svelte) --------------------
  ['evenement.section.chargement', 'Chargement de la section\u{2026}'],
  ['evenement.section.echec', 'Cette section ne s\u{2019}est pas chargée ; y revenir la recharge.'],

  // --- La barre de l'événement et sa place fixe (§ 8.3, § 8.4, § 8.5) ------
  ['evenement.barre.commandes', 'Commandes de l\u{2019}événement'],
  ['evenement.commande.defaire', 'Défaire'],
  ['evenement.commande.refaire', 'Refaire'],

  // --- La reprise d'un verrou dont la vie ne se prouve pas (§ 8.8) ----------
  ['evenement.verrou.titre', 'Le verrou qui tient cet événement'],
  ['evenement.verrou.seance', 'Séance'],
  ['evenement.verrou.depuis', 'Pris le'],
  ['evenement.verrou.inconnu', 'illisible'],
  [
    'evenement.verrou.avis',
    "Reprendre ce verrou n'est sûr que si cette séance est arrêtée : deux séances qui écrivent le même événement se contrediraient.",
  ],
  ['evenement.verrou.confirmerReprise', 'Confirmer la reprise de ce verrou'],

  // --- Les avertissements (§ 8.6, § 8.9, § 9) -------------------------------
  ['evenement.avertissements', 'Avertissements'],
  ['evenement.fautive.numero', 'Proposition n°'],
  ['evenement.fautive.rang', 'Proposition illisible, au rang'],
  ['evenement.derive.retenu', 'Placement retenu'],
  ['evenement.derive.proposition', 'Proposition n°'],

  // --- Le support rompu (§ 8.6) ----------------------------------------------
  ['evenement.supportRompu.abandonner', 'Fermer sans écrire ailleurs'],
  ['evenement.supportRompu.confirmerAbandon', "Confirmer : fermer sans l'écrire ailleurs"],
]);
