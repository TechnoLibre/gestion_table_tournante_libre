// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes de la coquille (§ 2.2, § 8.4, § 18.6, § 19.2) : le nom de
// l'application, le titre du bandeau et de la fenêtre, la provenance de la
// construction par mode de Vite, le libellé de mode, l'annonce de format, le
// réglage de thème, « Liste des événements », le panneau « Paramètres », le
// panneau « À propos » — son bloc, le logo, les liens, la licence,
// l'attribution et le sommaire des fonctionnalités —, et le titre de chaque
// section de l'événement, que la navigation et chaque section reprennent. Un
// mode sans clé s'affiche sous son propre nom (libelles.js). Chaque clé
// commence par « coquille. ».
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

  // Le logo de TechnoLibre : le nom du bouton qui ouvre son menu, les deux
  // téléchargements et l'issue d'un enregistrement.
  ['coquille.apropos.logo.menu', 'Télécharger le logo de TechnoLibre'],
  ['coquille.apropos.logo.telechargerSvg', 'Télécharger en SVG'],
  ['coquille.apropos.logo.telechargerPng', 'Télécharger en PNG'],
  ['coquille.apropos.logo.enregistre', ({ chemin }) => `Logo enregistré : ${chemin}`],

  // Les liens, par leur nom dans LIENS (apropos.js), et la phrase qui dit ce
  // qu'un clic fait.
  ['coquille.apropos.lien.site', 'https://technolibre.ca'],
  ['coquille.apropos.lien.projet', 'Code source du projet'],
  ['coquille.apropos.lien.agpl', 'AGPLv3, texte officiel'],
  ['coquille.apropos.lien.liliq', 'LiLiQ-R+, texte officiel'],
  ['coquille.apropos.liens.note', 'Un lien s\u{2019}ouvre dans votre navigateur ; le logiciel n\u{2019}envoie rien.'],

  // La licence : le choix entre les deux, l'identifiant SPDX, où lire les
  // textes complets, ce que la licence choisie demande, les contributions ;
  // puis la lecture des textes complets, livrés avec le logiciel.
  ['coquille.apropos.licence.titre', 'Licence'],
  ['coquille.apropos.licence.choix', 'Ce projet est distribué, au choix de l\u{2019}utilisateur, sous l\u{2019}une des licences suivantes :'],
  ['coquille.apropos.licence.agpl', 'GNU Affero General Public License v3.0 ou ultérieure (AGPL-3.0-or-later)'],
  ['coquille.apropos.licence.liliq', 'Licence Libre du Québec \u{2013} Réciprocité forte v1.1 (LiLiQ-R+)'],
  ['coquille.apropos.licence.spdx', 'Identifiant SPDX :'],
  ['coquille.apropos.licence.spdxValeur', 'AGPL-3.0-or-later OR LiLiQ-Rplus-1.1'],
  [
    'coquille.apropos.licence.textes',
    'Textes complets : dossier LICENSES/ des sources, et lisibles ici, sans réseau.',
  ],
  ['coquille.apropos.licence.respecter', 'Pour respecter la licence choisie :'],
  ['coquille.apropos.licence.obligation1', 'conservez les avis de copyright et de licence existants ;'],
  ['coquille.apropos.licence.obligation2', 'indiquez clairement vos modifications et leur date ;'],
  [
    'coquille.apropos.licence.obligation3',
    'toute version modifiée doit rester sous une licence à réciprocité forte (celle choisie ou une licence compatible) ;',
  ],
  ['coquille.apropos.licence.obligation4', 'si vous distribuez le logiciel, fournissez le code source correspondant ;'],
  [
    'coquille.apropos.licence.obligation5',
    'sous l\u{2019}AGPL, si vous offrez une version modifiée à des utilisateurs par un réseau (SaaS, instance web), ' +
      'vous devez leur donner accès à son code source.',
  ],
  ['coquille.apropos.licence.contributions', 'Les contributions à ce projet sont acceptées sous ces deux licences.'],
  ['coquille.apropos.licence.lireAgpl', 'Lire l\u{2019}AGPL-3.0-or-later'],
  ['coquille.apropos.licence.lireLiliq', 'Lire la LiLiQ-R+ 1.1'],
  ['coquille.apropos.licence.fermerTexte', 'Fermer le texte'],

  // L'attribution, une demande de courtoisie.
  ['coquille.apropos.attribution.titre', 'Attribution'],
  [
    'coquille.apropos.attribution.texte',
    'Si vous utilisez ce logiciel, modifié ou non, nous vous invitons à afficher le logo de TechnoLibre sur les badges ' +
      'des participants, puis sur votre site web avec un lien vers https://technolibre.ca. Il s\u{2019}agit d\u{2019}une ' +
      'demande, et non d\u{2019}une condition supplémentaire : vos droits et obligations sont définis uniquement ' +
      'par la licence que vous avez choisie.',
  ],

  // Le sommaire des fonctionnalités (fonctionnalites.js) : son titre, la
  // règle des numéros, le libellé de chaque catégorie sous son code, et
  // l'intitulé de chaque fonctionnalité sous son numéro, sans tiret.
  ['coquille.apropos.fonctionnalites.titre', 'Fonctionnalités'],
  [
    'coquille.apropos.fonctionnalites.explication',
    'Chaque fonctionnalité garde son numéro, que la spécification porte aussi ; un numéro retiré ne sert plus.',
  ],
  // Le numéro d'une fonctionnalité s'écrit tel quel, dans toute langue.
  ['coquille.apropos.numeroFonctionnalite', ({ numero }) => numero],
  ['coquille.apropos.categorie.pre', 'Préparer'],
  ['coquille.apropos.categorie.pla', 'Placer'],
  ['coquille.apropos.categorie.pro', 'Produire'],
  ['coquille.apropos.categorie.fic', 'Fichiers et sécurité'],
  ['coquille.apropos.categorie.int', 'Interface'],
  ['coquille.apropos.fonctionnalite.pre01', 'Importer la liste des participants en CSV, après un aperçu'],
  ['coquille.apropos.fonctionnalite.pre02', 'Réexporter les lignes refusées d\u{2019}un import'],
  ['coquille.apropos.fonctionnalite.pre03', 'Fondre les orthographes d\u{2019}une même organisation, jamais en silence'],
  ['coquille.apropos.fonctionnalite.pre04', 'Saisir et corriger les participants à la main'],
  ['coquille.apropos.fonctionnalite.pre05', 'Exporter la liste des participants en CSV, dans la forme qu\u{2019}il importe'],
  ['coquille.apropos.fonctionnalite.pre06', 'Étiqueter les personnes'],
  ['coquille.apropos.fonctionnalite.pre07', 'Dire la présence de chacun, tour par tour'],
  ['coquille.apropos.fonctionnalite.pre08', 'Exclure une personne, puis la réintégrer'],
  ['coquille.apropos.fonctionnalite.pre09', 'Créer les tables, avec un nombre de places par défaut et des surcharges'],
  ['coquille.apropos.fonctionnalite.pre10', 'Fixer le nombre de tours'],
  ['coquille.apropos.fonctionnalite.pre11', 'Donner des objectifs aux tables, à l\u{2019}écran ou en CSV, et les exporter'],
  ['coquille.apropos.fonctionnalite.pre12', 'Télécharger les modèles CSV et les fichiers d\u{2019}exemple'],
  ['coquille.apropos.fonctionnalite.pre13', 'Donner un libellé aux tables'],
  ['coquille.apropos.fonctionnalite.pla01', 'Disposer les tables sur un plan de salle à l\u{2019}échelle'],
  ['coquille.apropos.fonctionnalite.pla02', 'Déplacer et échanger les personnes sur le plan, au pointeur, au doigt ou par menu'],
  ['coquille.apropos.fonctionnalite.pla03', 'Désigner les animateurs, table par table'],
  ['coquille.apropos.fonctionnalite.pla04', 'Réserver des places à la main'],
  ['coquille.apropos.fonctionnalite.pla05', 'Refuser un geste impossible en nommant sa cause et son remède'],
  ['coquille.apropos.fonctionnalite.pla06', 'Lire le diagnostic avant toute recherche, avec le plafond et le plancher'],
  ['coquille.apropos.fonctionnalite.pla07', 'Choisir les critères et l\u{2019}ordre des priorités'],
  ['coquille.apropos.fonctionnalite.pla08', 'Générer plusieurs propositions comparables, reproductibles par leur graine'],
  ['coquille.apropos.fonctionnalite.pla09', 'Calculer les propositions en parallèle, sur les cœurs du poste'],
  ['coquille.apropos.fonctionnalite.pla10', 'Repartir d\u{2019}une proposition et en figer des tours'],
  ['coquille.apropos.fonctionnalite.pla11', 'Classer les propositions, et garder les meilleures'],
  ['coquille.apropos.fonctionnalite.pla12', 'Mesurer un placement sur la page de qualité'],
  ['coquille.apropos.fonctionnalite.pla13', 'Comparer deux placements par leur manque'],
  ['coquille.apropos.fonctionnalite.pla14', 'Retenir un placement'],
  ['coquille.apropos.fonctionnalite.pla15', 'Ajuster le placement retenu, qui suit les présences'],
  ['coquille.apropos.fonctionnalite.pla16', 'Signaler les tables en conflit sur le plan'],
  ['coquille.apropos.fonctionnalite.pla17', 'Inscrire le numéro de chaque table sur son plateau'],
  ['coquille.apropos.fonctionnalite.pro01', 'Produire la planche de badges en PDF, sur A4 ou Lettre'],
  ['coquille.apropos.fonctionnalite.pro02', 'Vérifier le découpage par la feuille de contrôle'],
  ['coquille.apropos.fonctionnalite.pro03', 'Ordonner les badges pour l\u{2019}accueil'],
  ['coquille.apropos.fonctionnalite.pro04', 'Ouvrir le dossier de l\u{2019}événement, où la planche se dépose'],
  ['coquille.apropos.fonctionnalite.pro05', 'Imprimer la liste d\u{2019}accueil'],
  ['coquille.apropos.fonctionnalite.pro06', 'Imprimer une feuille par table'],
  ['coquille.apropos.fonctionnalite.pro07', 'Imprimer le plan de salle, tour par tour'],
  ['coquille.apropos.fonctionnalite.pro08', 'Marquer BROUILLON ce qui n\u{2019}est pas retenu'],
  ['coquille.apropos.fonctionnalite.fic01', 'Garder chaque événement dans des fichiers ordinaires, listés au premier écran'],
  ['coquille.apropos.fonctionnalite.fic02', 'Enregistrer chaque geste avec son entrée d\u{2019}historique'],
  ['coquille.apropos.fonctionnalite.fic03', 'Revenir à un instant de l\u{2019}historique'],
  ['coquille.apropos.fonctionnalite.fic04', 'Ouvrir en lecture par défaut, modifier sur demande'],
  ['coquille.apropos.fonctionnalite.fic05', 'Bloquer un plan distribué'],
  ['coquille.apropos.fonctionnalite.fic06', 'Copier, renommer, importer et supprimer un événement, vers une corbeille'],
  ['coquille.apropos.fonctionnalite.fic07', 'Résister à une panne, et reprendre un fichier abîmé'],
  ['coquille.apropos.fonctionnalite.fic08', 'Choisir le dossier de travail'],
  ['coquille.apropos.fonctionnalite.fic09', 'Travailler hors ligne, sans rien envoyer'],
  ['coquille.apropos.fonctionnalite.int01', 'Grouper les sections en trois phases : Préparer, Placer, Produire'],
  ['coquille.apropos.fonctionnalite.int02', 'Charger une démonstration'],
  ['coquille.apropos.fonctionnalite.int03', 'Choisir le thème clair ou sombre'],
  ['coquille.apropos.fonctionnalite.int04', 'Régler la taille du texte de l\u{2019}écran'],
  ['coquille.apropos.fonctionnalite.int05', 'Agir au clavier, avec des contrastes vérifiés dans les deux thèmes'],
  ['coquille.apropos.fonctionnalite.int06', 'Voir la version partout, et la copier depuis « À propos »'],
  ['coquille.apropos.fonctionnalite.int07', 'Lire les licences, les liens et ce sommaire dans « À propos »'],

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
