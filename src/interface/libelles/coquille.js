// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes de la coquille (§ 8.4, § 18.6, § 19.2) : le nom de
// l'application, le titre du bandeau et de la fenêtre, la provenance de la
// construction par mode de Vite, le libellé de mode, l'annonce de format, le
// réglage de thème, « Liste des événements », le panneau « Paramètres », le
// panneau « À propos » et son bloc, et le titre de chaque section de
// l'événement, que la navigation et chaque section reprennent. Un mode sans clé s'affiche sous son propre nom
// (libelles.js). Chaque clé commence par « coquille. ».
export const TABLE = new Map([
  ['coquille.nom', 'Gestion table tournante Libre'],
  ['coquille.titre', ({ version }, texte) => `${texte('coquille.nom')} \u{2014} ${version}`],
  ['coquille.provenance.developpement', 'développement'],
  ['coquille.provenance.livraison', 'livraison'],
  ['coquille.provenance.documentation', 'documentation'],
  ['coquille.provenance.test', 'épreuve'],

  // Le mot qui précède la version au premier écran. La marque qui la
  // remplace dans une construction de documentation est une clé de
  // l'application (sorties.version.documentation) : le papier la lit aussi.
  ['coquille.version.libelle', 'version'],

  // Le libellé de mode, que rend cleDeMode (mode.js).
  ['coquille.mode.lecture', 'Lecture'],
  ['coquille.mode.ecriture', 'Écriture'],
  ['coquille.mode.bloque', 'Plan bloqué'],

  // L'annonce de la version de format du fichier ouvert (§ 18.6).
  ['coquille.format.plusRecent', 'Ce fichier s\u{2019}ouvre en lecture seule'],
  ['coquille.format.plusAncien', 'Ce fichier se convertira à votre première modification'],

  // Le réglage de thème (§ 19.2).
  ['coquille.theme.titre', 'Thème'],
  ['coquille.theme.clair', 'Clair'],
  ['coquille.theme.sombre', 'Sombre'],

  ['coquille.liste', 'Liste des événements'],

  // Le panneau « Paramètres » : la taille du texte de l'écran, un choix par
  // palier (src/geometrie/taille_texte.js), et le thème, sous
  // coquille.theme.titre.
  ['coquille.parametres.titre', 'Paramètres'],
  ['coquille.parametres.taille.titre', 'Taille du texte'],
  [
    'coquille.parametres.taille.explication',
    'Les écrans suivent cette taille ; le plan, les pages imprimées et les badges gardent la leur. ' +
      'Ce poste la retient d\u{2019}un lancement à l\u{2019}autre.',
  ],
  ['coquille.parametres.taille.palier', ({ taille }) => `${taille}\u{202F}%`],
  [
    'coquille.parametres.taille.nonRetenue',
    'La taille choisie vaut pour cette séance, sans être retenue sur ce poste : les réglages locaux ne se sont pas écrits.',
  ],
  ['coquille.parametres.theme.explication', 'Chaque lancement repart du thème du système ; le choix vaut pour la séance.'],
  ['coquille.parametres.fermer', 'Fermer'],

  // Le panneau « À propos ». Le bloc : nom, version affichée, plateforme,
  // provenance — son libellé, ou le mode lui-même quand il n'en a pas —,
  // version de format. Sous lui, l'éditeur et l'auteur du logiciel.
  ['coquille.apropos.titre', 'À propos'],
  [
    'coquille.apropos.bloc',
    ({ version, plateforme, provenance, format }, texte) => {
      const cle = `coquille.provenance.${provenance}`;
      return [
        texte('coquille.nom'),
        version,
        plateforme,
        texte.existe(cle) ? texte(cle) : provenance,
        texte('coquille.apropos.format', { format }),
      ].join(' \u{00B7} ');
    },
  ],
  ['coquille.apropos.format', ({ format }) => `format ${format}`],
  ['coquille.apropos.editeur', 'TechnoLibre Inc.'],
  ['coquille.apropos.auteur', 'Mathieu Benoit'],
  ['coquille.apropos.role', 'Développeur, concepteur et mainteneur du logiciel'],
  ['coquille.apropos.copier', 'Copier'],
  ['coquille.apropos.fermer', 'Fermer'],
  ['coquille.apropos.copie', 'Bloc copié dans le presse-papiers'],
  ['coquille.apropos.copieRefusee', 'Le presse-papiers a refusé la copie'],

  // Les sections de l'événement, dans l'ordre du § 2.1 (sections.js), et
  // leur navigation.
  ['coquille.navigation', 'Sections de l\u{2019}événement'],
  ['coquille.section.import', 'Import'],
  ['coquille.section.participants', 'Participants'],
  ['coquille.section.tables', 'Tables et tours'],
  ['coquille.section.plan', 'Plan'],
  ['coquille.section.diagnostic', 'Diagnostic'],
  ['coquille.section.generation', 'Génération'],
  ['coquille.section.propositions', 'Propositions'],
  ['coquille.section.qualite', 'Qualité'],
  ['coquille.section.badges', 'Badges'],
]);
