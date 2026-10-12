// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'exécuteur de production de la génération (§ 5.7, § 5.10, § 13.4) : la
// recherche tourne dans un groupe de travailleurs, hors du fil de
// l'interface, et l'exécuteur adapte leur protocole — celui de
// generation_travailleur.js — au contrat Executeur du contrôleur de
// génération (generation.js).
//
// Un lancer fait naître W = min(nombre, coeurs) travailleurs. Les rangs des
// propositions, 1 à nombre, se donnent dans l'ordre croissant : le
// travailleur k reçoit d'abord le rang k, puis chaque rang suivant va au
// premier travailleur qui rend sa proposition. Celui qui n'a plus de rang à
// recevoir est terminé aussitôt. Chaque proposition se calcule de sa graine
// dérivée, la même quel que soit le travailleur qui la calcule (proposerUne) :
// le résultat, rangé par identifiant, est octet pour octet celui de
// rechercher, course de chaque proposition comprise, quel que soit W et quel
// que soit l'ordre d'achèvement (§ 5.7). Aucun travailleur ne date une
// proposition : la durée est celle que le contrôleur prend autour du calcul
// entier.
//
//   → { type: 'proposer', configuration, reglages, rang }  un rang à la fois
//   ← { type: 'avancement', fait, total }        fait dans la proposition en
//                                                cours de ce travailleur
//   ← { type: 'proposition', proposition }       range la proposition, puis
//                                                le rang suivant ou la fin
//   ← { type: 'erreur', code, details }          rejette par ErreurGeneration
//   ← { type: 'faute', message, pile }           rejette par une Error, une faute
//   ✕ canal d'erreur d'un travailleur            rejette par TRAVAILLEUR_EN_ECHEC
//
// L'avancement remis aux abonnés est la somme, sur toutes les propositions,
// des mouvements évalués — le dernier avancement reçu pour une proposition
// en cours, son arret entier pour une proposition rendue —, sur
// nombre × arret ; il ne décroît jamais.
//
// Un travailleur poste ses fautes de calcul en message : son canal d'erreur
// ne porte que l'échec de son script, qui ne se charge ou ne se compile pas.
//
// L'issue — résultat, erreur, faute, échec d'un script ou annulation —
// termine tous les travailleurs du lancer, dans le même tour. Terminé, un
// travailleur ne remet plus rien : un message déjà en file à cet instant ne
// parvient ni aux abonnés ni au résultat. L'annulation est terminate() de
// chacun : immédiate, sans résultat partiel. La fabrique est un paramètre :
// src/main.js la construit sur le travailleur inclus dans la page, avec le
// nombre de processeurs logiques du poste ; une épreuve, sur des
// travailleurs factices. Ce module ne touche aucune plateforme.
import { ErreurAnnulee, ErreurGeneration, coeursDe, exigerReglages } from './generation.js';

/**
 * L'exécuteur du groupe de travailleurs.
 *
 * @param {() => {postMessage: (message: Object) => void, terminate: () => void,
 *   onmessage: ((evenement: {data: Object}) => void)|null,
 *   onerror?: ((evenement: {message?: string}) => void)|null}} fabrique
 *   rend un travailleur neuf à chaque appel
 * @param {{coeursDisponibles?: unknown}} [options]   le nombre de processeurs
 *   logiques du poste, que l'exécuteur rend par coeursDe : 1 quand il n'est
 *   pas un entier d'au moins 1
 * @returns {import('./generation.js').Executeur}
 *   coeursDisponibles ; lancer(configuration, reglages, { coeurs = 1 }) rend
 *   une Execution, coeurs étant le nombre de travailleurs qu'elle emploie.
 *   Un réglage hors de son domaine la rejette par REGLAGE_HORS_DOMAINE
 *   (exigerReglages), sans travailleur, coeurs valant 0 ; un nombre de
 *   cœurs qui n'est pas un entier d'au moins 1 lève une RangeError, une
 *   faute de l'appelant. avancement → surAvancement, la somme de l'en-tête ;
 *   la dernière proposition rangée → la promesse résolue aux propositions
 *   par identifiant croissant ; erreur {code, details} → rejet par
 *   ErreurGeneration(code, details) ; faute {message, pile} → rejet par une
 *   Error sans code, dont le message porte celui du travailleur et la pile
 *   la sienne : elle remonte comme une faute, comme sous l'exécuteur
 *   direct ; canal d'erreur d'un travailleur — son script ne se charge ou ne
 *   se compile pas —, → rejet par ErreurGeneration('TRAVAILLEUR_EN_ECHEC',
 *   { remede: null }), l'événement traité : aucun geste de la page ne
 *   relance un travailleur que le navigateur refuse, et le texte du refus
 *   nomme sa cause (§ 5.9) ; annuler() → terminate() de chacun aussitôt,
 *   rejet par ErreurAnnulee, plus aucun avancement. Après l'issue, annuler()
 *   ne fait rien.
 */
export function creerExecuteurTravailleur(fabrique, { coeursDisponibles } = {}) {
  return {
    coeursDisponibles: coeursDe(coeursDisponibles),
    lancer(configuration, reglages, { coeurs = 1 } = {}) {
      if (!Number.isInteger(coeurs) || coeurs < 1) {
        throw new RangeError(`coeurs : entier d'au moins 1 attendu, reçu ${String(coeurs)}`);
      }
      const abonnes = new Set();
      let termine = false;
      let resoudre;
      let rejeter;
      const resultat = new Promise((ok, ko) => {
        resoudre = ok;
        rejeter = ko;
      });
      const surAvancement = (fn) => {
        abonnes.add(fn);
        return () => {
          abonnes.delete(fn);
        };
      };

      try {
        exigerReglages(reglages);
      } catch (erreur) {
        rejeter(erreur);
        return { surAvancement, resultat, annuler() {}, coeurs: 0 };
      }

      const { nombre, arret } = reglages;
      const total = nombre * arret;
      // propositions[r − 1] : la proposition de rang r, rangée ; faits[r − 1] :
      // les mouvements évalués de ce rang ; fait, leur somme.
      const propositions = new Array(nombre);
      const faits = new Array(nombre).fill(0);
      let fait = 0;
      let rangees = 0;
      let prochain = 1;
      const travailleurs = [];

      function publier() {
        for (const fn of [...abonnes]) fn(fait, total);
      }

      // Porte les mouvements évalués du rang à valeur, s'ils croissent, et
      // publie la somme nouvelle.
      function avancer(rang, valeur) {
        if (valeur <= faits[rang - 1]) return;
        fait += valeur - faits[rang - 1];
        faits[rang - 1] = valeur;
        publier();
      }

      // Un travailleur arrêté : ses gestionnaires retirés, il ne remet plus rien.
      function arreter(travailleur) {
        travailleur.onmessage = null;
        travailleur.onerror = null;
        travailleur.terminate();
      }

      // L'issue : chaque travailleur encore en vie est arrêté.
      function terminer() {
        termine = true;
        for (const suivi of travailleurs) {
          if (suivi.vivant) {
            suivi.vivant = false;
            arreter(suivi.travailleur);
          }
        }
      }

      function echouer(erreur) {
        rejeter(erreur);
        terminer();
      }

      // Donne au travailleur suivi le rang suivant, ou l'arrête quand il
      // n'en reste plus.
      function confier(suivi) {
        if (prochain > nombre) {
          suivi.vivant = false;
          suivi.rang = null;
          arreter(suivi.travailleur);
          return;
        }
        suivi.rang = prochain;
        prochain += 1;
        suivi.travailleur.postMessage({ type: 'proposer', configuration, reglages, rang: suivi.rang });
      }

      function recevoir(suivi, data) {
        if (termine || !suivi.vivant) return;
        if (data.type === 'avancement') {
          avancer(suivi.rang, data.fait);
        } else if (data.type === 'proposition') {
          const { rang } = suivi;
          propositions[rang - 1] = data.proposition;
          rangees += 1;
          avancer(rang, arret);
          if (rangees === nombre) {
            resoudre(propositions);
            terminer();
          } else {
            confier(suivi);
          }
        } else if (data.type === 'erreur') {
          echouer(new ErreurGeneration(data.code, data.details));
        } else if (data.type === 'faute') {
          const faute = new Error(`travailleur de génération : ${data.message}`);
          faute.stack = `${faute.stack}\n${data.pile}`;
          echouer(faute);
        }
      }

      const paralleles = Math.min(nombre, coeurs);
      for (let k = 0; k < paralleles; k += 1) {
        const suivi = { travailleur: fabrique(), rang: null, vivant: true };
        travailleurs.push(suivi);
        suivi.travailleur.onmessage = ({ data }) => recevoir(suivi, data);
        // Le script du travailleur ne se charge ou ne se compile pas : le
        // refus TRAVAILLEUR_EN_ECHEC, que la commande « Générer » pose à côté
        // d'elle, jamais le message du moteur d'exécution. L'événement est
        // traité : le navigateur ne le signale pas en plus comme une faute de
        // la page. Une faute du calcul arrive en message, jamais ici.
        suivi.travailleur.onerror = (evenement) => {
          evenement?.preventDefault?.();
          if (termine || !suivi.vivant) return;
          echouer(new ErreurGeneration('TRAVAILLEUR_EN_ECHEC', { remede: null }));
        };
      }
      for (const suivi of travailleurs) confier(suivi);

      return {
        surAvancement,
        resultat,
        annuler() {
          if (termine) return;
          terminer();
          rejeter(new ErreurAnnulee());
        },
        coeurs: paralleles,
      };
    },
  };
}
