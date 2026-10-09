// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La planche de badges dans la séance (§ 11.2, § 11.6, § 11.8) : préparer
// l'annonce, produire le PDF et le déposer, l'enregistrer ailleurs. Sortir
// n'est pas modifier (§ 8.4, § 9) : rien ici n'écrit le fichier d'état ni le
// journal, ne prend de verrou ni ne lit le mode de la séance ; la seule
// écriture est celle du PDF, à côté des fichiers d'événement, ou son
// téléchargement sous web, où le dossier de travail est invisible à
// l'opérateur (décision 13). Une écriture du PDF refusée se dit
// PLANCHE_NON_ECRITE, remède « Enregistrer sous… », sans toucher au support
// de l'événement.
//
// La production vit dans src/pdf, chargé par un seul import() différé : le
// paquet n'embarque pdf-lib qu'au premier besoin, et cette couche ne voit
// jamais un objet de pdf-lib, seulement des octets. La police arrive en
// octets, par la fonction que la séance reçoit, chargée une fois.
//
// Une demande désigne la source — le retenu, ou une proposition par son
// identifiant, toujours BROUILLON (Q3) —, l'imposition, l'ordre de la pile
// et, pour une réédition, la sélection. Les refus s'ordonnent : ceux du
// placement (refusPlanche), puis ceux de la mise en page, nommant la
// personne du badge refusé, puis le papier à choisir.
import { PAPIERS } from '../geometrie/papiers.js';
import { nombrePlanches } from '../pdf/imposition.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { nomPlanche } from '../stockage/noms.js';
import { ErreurCommande, refus } from './erreurs.js';
import { libelle } from './libelles.js';
import { IMPOSITIONS, ORDRES, modelePlanche, refusPlanche, refusProduction, textesControle } from './planche.js';
import { estBrouillon } from './sorties.js';

// La production du PDF, chargée au premier appel ; le module se garde en
// cache, comme tout module chargé.
const chargerProduction = () => import('../pdf/planche.js');

/**
 * Ce que la séance lit de l'événement ouvert, à son tour dans la file de ses
 * appels.
 *
 * @typedef {Object} LecturePlanche
 * @property {import('../stockage/types.js').Charge} charge
 * @property {string} base       la base des fichiers de l'événement
 * @property {import('../stockage/systeme_fichiers.js').SystemeFichiers} fs
 * @property {import('../stockage/systeme_fichiers.js').Racine} racine   celle des fichiers de l'événement
 * @property {'A4'|'Lettre'|null} papier   celui des réglages locaux, null sans choix
 *
 * @typedef {Object} DemandePlanche
 * @property {'retenu'|'proposition'} [source]   'retenu' par défaut
 * @property {number|null} [proposition]          l'identifiant de la proposition imprimée
 * @property {'feuille'|'pile'} [imposition]      'feuille' par défaut
 * @property {'alphabetique'|'table'} [ordre]     'alphabetique' par défaut
 * @property {number[]|null} [selection]          les personnes à rééditer ; null : toutes
 *
 * @typedef {Object} Annonce
 * @property {null|{code: string, details: Object}} refus   le premier refus, remède dans les détails
 * @property {'A4'|'Lettre'|null} papier
 * @property {null|{participants: number, exclus: number, produits: number}} comptes
 * @property {null|Object<string, number>} planches   par papier, le nombre de planches
 * @property {Array<{nom: string, ids: number[]}>} homonymes
 * @property {string[]} absents   les caractères sans glyphe, à leur première rencontre
 * @property {boolean} brouillon
 * @property {string|null} nom    le nom du fichier ; null sans papier
 */

// Le refus du papier à choisir : rien ne se produit sans lui (§ 11.2). Un
// objet neuf à chaque refus.
const papierRequis = () => ({ code: 'PAPIER_REQUIS', details: { remede: { geste: 'choisirPapier' } } });

// La demande lue, ses défauts posés ; une imposition ou un ordre hors de sa
// liste est une faute du code, levée avant tout refus du placement. La
// source et la sélection se contrôlent où elles se lisent (planche.js).
function demandeLue({ source = 'retenu', proposition = null, imposition = 'feuille', ordre = 'alphabetique', selection = null } = {}) {
  if (!IMPOSITIONS.includes(imposition)) {
    throw new TypeError(`imposition : ${IMPOSITIONS.join(' ou ')} attendue, reçu ${JSON.stringify(imposition)}`);
  }
  if (!ORDRES.includes(ordre)) throw new TypeError(`ordre : ${ORDRES.join(' ou ')} attendu, reçu ${JSON.stringify(ordre)}`);
  return { source, proposition, imposition, ordre, selection };
}

// Le nombre de planches de n badges, pour chaque papier : l'annonce les
// donne tous deux avant que le papier ne soit choisi (§ 11.2).
const planchesDe = (n) => Object.fromEntries(Object.keys(PAPIERS).map((papier) => [papier, nombrePlanches(n, papier)]));

/**
 * Les opérations de la planche d'une séance.
 *
 * @param {Object} parametres
 * @param {(() => Promise<{regulier: Uint8Array, gras: Uint8Array}>)|null} parametres.polices
 *        charge les octets de la police embarquée ; appelée au premier
 *        besoin, puis gardée — un chargement refusé se réessaie au suivant
 * @param {string|null} parametres.provenance   le mode de construction
 * @param {string} parametres.version           la version affichée
 * @returns {{preparer: (lecture: LecturePlanche, demande?: DemandePlanche) => Promise<Annonce>,
 *   produire: (lecture: LecturePlanche, demande?: DemandePlanche) => Promise<{chemin: string|null, nom: string}>,
 *   enregistrerSous: (lecture: LecturePlanche, demande?: DemandePlanche) => Promise<string|null>}}
 */
export function creerPlanches({ polices, provenance, version }) {
  let octetsPolices = null;

  // Les octets de la police, chargés une fois ; une promesse rejetée ne se
  // garde pas.
  function lesPolices() {
    if (typeof polices !== 'function') throw new TypeError('polices : la fonction qui charge la police embarquée attendue');
    if (octetsPolices === null) {
      octetsPolices = Promise.resolve().then(polices);
      octetsPolices.catch(() => {
        octetsPolices = null;
      });
    }
    return octetsPolices;
  }

  // L'étude d'une demande : le refus du placement, ou le modèle, son
  // analyse par la mise en page et le refus qu'elle porte. Un refus de mise
  // en page reçoit la personne du badge refusé, que src/pdf ne connaît pas.
  // Rien ne s'écrit.
  async function etudier({ charge, papier }, demande) {
    const { source, proposition, ordre, selection, imposition } = demandeLue(demande);
    const rejet = refusPlanche(charge, { source, proposition });
    if (rejet !== null) return { refus: rejet, modele: null, absents: [], papier, imposition, source };
    if (typeof provenance !== 'string') throw new TypeError('provenance : le mode de construction attendu');
    const modele = modelePlanche(charge, { source, proposition, ordre, selection, provenance, version });
    const octets = await lesPolices();
    const { analyserPlanche } = await chargerProduction();
    const analyse = await analyserPlanche({ modele, polices: octets });
    let leRefus = null;
    if (analyse.refus !== null) {
      const { code, details, rang } = analyse.refus;
      const badge = modele.badges[rang];
      const personne = code === 'PLANCHE_NOM_TROP_LONG' ? { participant: badge.participant, personne: badge.nom } : {};
      leRefus = refusProduction(code, { ...details, ...personne });
    } else if (papier === null) {
      leRefus = papierRequis();
    }
    return { refus: leRefus, modele, absents: analyse.absents, papier, imposition, source };
  }

  // Le nom du fichier d'une étude, null sans papier.
  const nomDe = (base, { modele, papier, imposition }) =>
    papier === null ? null : nomPlanche(base, { papier, imposition, horodatage: modele.horodatage, reedition: modele.reedition });

  // Les octets de la planche d'une demande, et son nom ; le refus de
  // l'étude lève, ErreurCommande, avant que rien ne se produise.
  async function octetsDe(lecture, demande) {
    const etude = await etudier(lecture, demande);
    if (etude.refus !== null) throw new ErreurCommande(etude.refus.code, etude.refus.details);
    const { modele, papier, imposition, absents } = etude;
    const planches = nombrePlanches(modele.badges.length, papier);
    const controle = textesControle(modele, { papier, imposition, planches, absents });
    const { produirePlanche } = await chargerProduction();
    const octets = await produirePlanche({
      modele,
      papier,
      imposition,
      polices: await lesPolices(),
      controle,
      filigrane: libelle('planche.brouillon'),
    });
    return { octets, nom: nomDe(lecture.base, etude) };
  }

  return {
    /**
     * L'annonce de la planche, avant de produire (§ 11.2, § 11.5, § 11.8,
     * décision 12). Un refus du placement rend l'annonce sans modèle :
     * comptes, planches et nom null, ni homonymes ni absents, le brouillon
     * de la source. Sans papier, refus PAPIER_REQUIS et nom null, les
     * planches des deux papiers données. Rien ne s'écrit.
     *
     * @throws {TypeError} une demande hors de son domaine, une séance sans
     *         polices ou sans provenance
     * @throws {ErreurCommande} PROPOSITION_INCONNUE, PARTICIPANT_INCONNU,
     *         PERSONNE_EXCLUE (modelePlanche)
     */
    async preparer(lecture, demande) {
      const etude = await etudier(lecture, demande);
      const { charge, papier } = lecture;
      if (etude.modele === null) {
        return {
          refus: etude.refus,
          papier,
          comptes: null,
          planches: null,
          homonymes: [],
          absents: [],
          brouillon: estBrouillon(charge, { source: etude.source, tour: 'tous' }),
          nom: null,
        };
      }
      const { modele } = etude;
      return {
        refus: etude.refus,
        papier,
        comptes: modele.comptes,
        planches: planchesDe(modele.badges.length),
        homonymes: modele.homonymes,
        absents: etude.absents,
        brouillon: modele.brouillon,
        nom: nomDe(lecture.base, etude),
      };
    },

    /**
     * Produit la planche et la dépose (§ 11.6) : à côté des fichiers
     * d'événement, par une écriture atomique, sous electron et sur le
     * système d'épreuve, et rend son chemin en entier ; sous web, par
     * enregistrerSous, le téléchargement, et chemin null. Le refus de
     * l'annonce lève, sans rien écrire. Une écriture refusée par le support
     * lève PLANCHE_NON_ECRITE {chemin, dossier, cause}, remède
     * « Enregistrer sous… » : le support de l'événement n'en est pas rompu.
     *
     * @throws {ErreurCommande} le refus de l'annonce ; PLANCHE_NON_ECRITE
     */
    async produire(lecture, demande) {
      const { octets, nom } = await octetsDe(lecture, demande);
      const { fs, racine } = lecture;
      if (fs.nature === 'web') {
        await fs.enregistrerSous(nom, octets);
        return { chemin: null, nom };
      }
      try {
        await fs.ecrireOctetsAtomique(racine, nom, octets);
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage && erreur.code === 'ECRITURE')) throw erreur;
        const { chemin, dossier, cause } = erreur.details;
        throw refus('PLANCHE_NON_ECRITE', { chemin, dossier, cause }, { geste: 'enregistrerSous' });
      }
      const { separateur } = await fs.emplacements();
      const tete = racine.chemin.endsWith(separateur) ? racine.chemin : racine.chemin + separateur;
      return { chemin: tete + nom, nom };
    },

    /**
     * Produit la planche et la confie au dialogue d'enregistrement de la
     * plateforme, sous le nom de la planche : le remède d'une écriture
     * refusée. Rend le chemin choisi, null quand l'opérateur annule.
     *
     * @throws {ErreurCommande} le refus de l'annonce
     */
    async enregistrerSous(lecture, demande) {
      const { octets, nom } = await octetsDe(lecture, demande);
      return lecture.fs.enregistrerSous(nom, octets);
    },
  };
}
