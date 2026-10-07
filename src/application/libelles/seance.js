// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des codes de la séance (§ 8.3 à § 8.8, § 14.6), et les libellés
// figés que la séance écrit au journal : jalons, reprise, retours. Un libellé
// d'entrée se compose une fois, à l'écriture du geste, et le journal en garde
// le texte, jamais le code (§ 8.2).
import { causeEntreParentheses, cite, depuisQuand, nomEtat, ouEcrire } from './aides.js';

export const TABLE = new Map([
  // --- La séance (§ 8.3, § 8.4, § 8.5, § 8.6, § 8.8) -------------------------
  ['AUCUN_EVENEMENT', () => "Aucun événement n'est ouvert."],
  ['MODE_LECTURE', () => "L'événement est ouvert en lecture : « Modifier » permet de le changer."],
  ['FORMAT', (details, texte) => texte('FORMAT_PLUS_RECENT', details)],
  ['BLOQUE', () => 'Le plan est bloqué.'],
  // echec nomme ce que le support n'a pas reçu : la ligne d'un geste
  // (ECRITURE), l'état d'un geste inscrit au journal (ETAT_NON_ECRIT), le
  // jalon d'un geste enregistré (JALON_NON_ECRIT), ou le verrou d'un passage
  // en écriture (VERROU_NON_ECRIT), qui ne perd rien.
  [
    'SUPPORT_ROMPU',
    ({ echec, ...details }, texte) => {
      const refus = `Le support ne prend plus les écritures : ${ouEcrire(details, texte)} n'a pas pu s'écrire`;
      const ailleurs = "« Écrire ailleurs » enregistre l'événement dans un autre dossier.";
      if (echec === 'ECRITURE' || echec === 'ETAT_NON_ECRIT') {
        const perte =
          echec === 'ETAT_NON_ECRIT'
            ? "le dernier geste est inscrit à l'historique, mais pas dans l'état"
            : "le dernier geste n'est pas enregistré";
        return `${refus}, et ${perte}. Sur ce support, l'historique et l'état ne se correspondent plus ; ${ailleurs}`;
      }
      if (echec === 'JALON_NON_ECRIT') {
        return (
          `${refus}. Le dernier geste est enregistré, mais pas le jalon qui le nomme, ` +
          `et aucun geste ne s'y enregistrerait plus ; ${ailleurs}`
        );
      }
      if (echec === 'VERROU_NON_ECRIT') {
        return (
          `${refus}. L'événement y reste tel qu'il s'affiche, ` +
          `mais aucun geste ne s'y enregistrerait ; ${ailleurs}`
        );
      }
      throw new RangeError(`libelle : échec du support inconnu ${JSON.stringify(echec)}`);
    },
  ],
  ['SUPPORT_INTACT', () => "Le support prend encore les écritures : l'événement reste où il est."],
  // Quitter l'événement d'un support rompu : la séance tient la seule copie
  // que l'écriture ailleurs peut encore sauver ; ETAT_NON_ECRIT dit que son
  // dernier geste n'est qu'à l'historique de ce support.
  [
    'SUPPORT_ROMPU_NON_SAUVE',
    ({ echec, dossier }) => {
      const geste =
        echec === 'ETAT_NON_ECRIT' ? ", et son dernier geste n'y est inscrit qu'à l'historique" : '';
      return (
        `Le support ${cite(dossier)} ne prend plus les écritures${geste} : ` +
        "l'événement ouvert n'est sauvé dans aucun autre dossier. " +
        "« Écrire ailleurs » l'enregistre d'abord ; le quitter maintenant l'abandonne à ce support."
      );
    },
  ],
  [
    'EVENEMENT_CHANGE',
    ({ revision }) =>
      `Une autre séance a modifié cet événement depuis son ouverture : il s'affiche tel qu'elle l'a laissé, ` +
      `à la révision ${revision}, et les gestes suivants s'y ajoutent.`,
  ],
  [
    'VERROU_REPRIS',
    ({ depuis }, texte) => `Le verrou qu'une séance interrompue de ce poste avait laissé${depuisQuand(depuis, texte)} est repris.`,
  ],
  [
    'VERROU_NON_RENDU',
    ({ cause }, texte) =>
      `Le verrou de l'événement n'a pas pu être rendu${causeEntreParentheses(cause, texte)} : ` +
      'une autre séance de ce poste le reprendra une fois ce logiciel fermé.',
  ],
  ['RIEN_A_DEFAIRE', () => "Rien à défaire : l'historique commence à cet instant."],
  ['RIEN_A_REFAIRE', () => 'Rien à refaire : seul un retour se refait, tant que nul geste ne le suit.'],
  ['INSTANT_NON_RESTITUABLE', ({ revision }) => `L'historique ne restitue plus l'instant ${revision}.`],
  [
    'JALON_NON_ECRIT',
    ({ dossier, cause }, texte) =>
      `Le geste est enregistré, mais le jalon qui le nomme n'a pas pu s'écrire ` +
      `dans le dossier ${cite(dossier)}${causeEntreParentheses(cause, texte)}.`,
  ],
  ['SANS_EFFET', () => "Ce geste ne change rien : rien n'est enregistré."],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['JALON_CREATION', () => 'Création'],
  ['JALON_ETAT', ({ etat }) => `État ${cite(nomEtat(etat))}`],
  ['JALON_AVANT_GENERATION', () => 'Avant la génération'],
  ['ENTREE_REPRISE', () => "Reprise de l'état trouvé sur le disque"],
  ['ENTREE_DEFAIRE', ({ libelle: instant }) => `Défait : ${cite(instant)}`],
  ['ENTREE_REFAIRE', ({ libelle: instant }) => `Refait : ${cite(instant)}`],
  ['ENTREE_REVENIR', ({ libelle: instant }) => `Retour à ${cite(instant)}`],
]);
