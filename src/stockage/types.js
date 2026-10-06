// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Contrat de données du stockage : le fichier d'état, le journal, les
// fichiers voisins d'un événement, les erreurs que lève le stockage et les
// codes des fautes de placement. Ce module ne porte que des définitions
// JSDoc et n'exécute rien ; un module cite un type par
// import('./types.js').Charge. Les valeurs que ces formes portent sont
// définies par leurs modules : FORMAT, GENERATION_PAR_DEFAUT et SCHEMA par
// le module du document, les constantes du journal par journal.js, les
// suffixes des fichiers par noms.js ; l'interface du système de fichiers
// est déclarée par systeme_fichiers.js.
//
// Les chaînes de saisie sont en NFC : la conversion se fait à l'entrée — CSV,
// commandes —, jamais à l'écriture. Une chaîne « non vide » compte au moins
// une unité ; un champ « chaîne ou null » porte null plutôt qu'une chaîne
// vide. Un entier est un entier exact, au plus 2^53 − 1.

/**
 * Le fichier d'état, format 1 (§ 8.8, § 8.9). Deux régions : l'en-tête et la
 * charge. Les comparaisons qui traversent les constructions — empreinte des
 * démonstrations, aller-retour des fichiers livrés — portent sur la charge
 * seule. Toute clé hors de ces formes est une faute de forme. Le texte est
 * en UTF-8 sans marque d'ordre d'octets, fin de ligne LF, une seule fin de
 * ligne finale, dans la forme canonique qu'écrit canonique.js.
 *
 * @typedef {Object} Fichier
 * @property {Entete} entete
 * @property {Charge} charge
 *
 * @typedef {Object} Entete
 * @property {number} format          FORMAT ; un format plus récent se lit et
 *                                    s'ouvre en lecture seule (§ 8.8)
 * @property {string} produitVersion  non vide : version affichée de la
 *                                    construction qui a écrit en dernier (§ 18.6)
 * @property {number} revision        entier ≥ 1 : révision de la dernière
 *                                    entrée de journal que l'état reflète
 * @property {Comptes} comptes
 *
 * @typedef {Object} Comptes   longueur de la liste de la charge du même nom
 * @property {number} participants
 * @property {number} tables
 * @property {number} reservations
 * @property {number} titres
 * @property {number} propositions
 * @property {number} retenu         0 ou 1
 *
 * @typedef {Object} Charge
 * @property {Evenement} evenement
 * @property {Reglages} reglages
 * @property {ProchainsIds} prochainsIds
 * @property {Participant[]} participants  triés par id
 * @property {Table[]} tables              triées par id
 * @property {Reservation[]} reservations  triées par participant, table,
 *                                         portée (tous avant tour), tour puis
 *                                         siège, null en tête
 * @property {Titre[]} titres              triés par table, siège puis libellé
 * @property {PropositionFichier[]} propositions  triées par id, puis
 *                                         graine, arret, historique et
 *                                         texte canonique : la lecture du
 *                                         document n'en contrôle que la
 *                                         liste, et admet deux propositions
 *                                         de même id ; leur forme, leur
 *                                         cohérence et leurs identifiants se
 *                                         contrôlent à part (placements.js)
 * @property {Retenu|null} retenu          le placement en vigueur
 *
 * @typedef {Object} Evenement
 * @property {string} id               non vide : identifiant interne, qui
 *                                     apparie l'état et le journal (§ 8.6)
 * @property {string} nom              non vide : l'autorité, dont le nom de
 *                                     fichier dérive
 * @property {string|null} date        AAAA-MM-JJ d'un jour du calendrier
 * @property {number} siegesParDefaut  entier ≥ 2 (§ 6.1)
 * @property {number} tours            R, entier ≥ 1
 * @property {'cm'} unite              (§ 7.2)
 * @property {'brouillon'|'propose'|'retenu'|'bloque'} etat   (§ 9)
 * @property {Filiation|null} filiation  (§ 8.7)
 *
 * @typedef {Object} Filiation
 * @property {{id: string, nom: string}} source             chaînes non vides
 * @property {{revision: number, libelle: string}} instant  révision ≥ 1,
 *                                                          libellé non vide
 *
 * @typedef {Object} Reglages
 * @property {boolean} separerAppartenances
 * @property {boolean} nouveauxVoisins
 * @property {boolean} nouvelleTable
 * @property {boolean} varierAppartenances
 * @property {boolean} attribuerSieges   le réglage que reçoit la prochaine
 *                                       génération ; il ne décide d'aucun
 *                                       tri : chaque proposition porte son
 *                                       propre siegesAttribues
 * @property {{nombre: number, arret: number, historique: number}} generation
 *                                       entiers ≥ 1
 *
 * @typedef {Object} ProchainsIds   entiers ≥ 1, au-delà de tout identifiant
 *                                  attribué ; ils ne reculent jamais, et un
 *                                  identifiant ne se réattribue pas (§ 4)
 * @property {number} participant
 * @property {number} table
 * @property {number} proposition   au-delà de chaque identifiant de
 *                                  proposition et de retenu.proposition ;
 *                                  unique à travers les générations
 *                                  accumulées, il ne revient pas après un
 *                                  effacement (§ 5.7). Le contrôle des
 *                                  placements le compare : une proposition
 *                                  qui l'atteint s'écarte, un retenu se
 *                                  signale (IDENTIFIANT_HORS_COMPTEUR) ; la
 *                                  charge qu'il rend le relève au-delà de
 *                                  chaque identifiant lu, écartées et
 *                                  origine du retenu comprises : abaissé à
 *                                  la main, il ne fait réattribuer aucun
 *                                  d'eux
 *
 * @typedef {Object} Participant
 * @property {number} id                    entier ≥ 1, unique
 * @property {string} nom                   non vide
 * @property {string|null} prenom
 * @property {string|null} appartenance
 * @property {string|null} courriel
 * @property {string|null} titrePressenti   informatif (§ 4)
 * @property {string|null} notes
 * @property {boolean} exclu                (§ 4.4)
 *
 * @typedef {Object} Table
 * @property {number} id            entier ≥ 1, unique
 * @property {number} numero        affiché, entier ≥ 1
 * @property {number|null} sieges   null : suit le défaut ; entier ≥ 2 :
 *                                  surcharge (§ 6.1)
 * @property {'ronde'|'carree'} forme
 * @property {{x: number, y: number}} position   nombres finis, en cm
 *
 * @typedef {Object} Reservation
 * @property {number} participant   id d'un participant de la charge, exclu
 *                                  compris : sa réservation est suspendue
 * @property {number} table         id d'une table
 * @property {number|null} siege    de 1 à la capacité de la table, ou null
 * @property {'tous'|'tour'} portee (§ 4.3)
 * @property {number|null} tour     null pour la portée tous, de 1 à R sinon
 *
 * @typedef {Object} Titre
 * @property {number} table     id d'une table
 * @property {number} siege     de 1 à la capacité de la table
 * @property {string} libelle   non vide
 */

/**
 * Forme positionnelle d'un placement (§ 8.9). tables et capacites se
 * correspondent rang à rang ; placement porte un tour par élément :
 * sieges[i] liste les occupants de tables[i] dans l'ordre des sièges —
 * triés par identifiant quand siegesAttribues est faux —, reserve ceux qui
 * ne sont assis nulle part à ce tour. siegesAttribues appartient à la
 * proposition, ou au retenu, et non au réglage courant : changer le réglage
 * ne détruit pas l'ordre des sièges d'une proposition déjà produite.
 * participants et chaque reserve sont des ensembles, triés par identifiant
 * croissant quel que soit siegesAttribues.
 *
 * @typedef {Object} TourDePlacement
 * @property {number[][]} sieges
 * @property {number[]} reserve       triée par identifiant croissant
 *
 * @typedef {Object} PropositionFichier
 * @property {number} id              entier ≥ 1 : place dans la suite des
 *                                    graines dérivées (§ 5.7)
 * @property {number} graine          graine dérivée, 0 ≤ g < 2^32
 * @property {number} arret           compte d'arrêt, ≥ 1
 * @property {number} historique      longueur de l'historique d'acceptation, ≥ 1
 * @property {string} produitVersion  construction qui l'a produite
 * @property {boolean} siegesAttribues   l'ordre dans une table est un numéro
 *                                    de siège ; faux : chaque liste de table
 *                                    se trie par identifiant croissant
 * @property {number[]} tables        identifiants de table, dans l'ordre des
 *                                    listes de chaque tour
 * @property {number[]} capacites     capacité de chacune
 * @property {number} tours
 * @property {number[]} participants  identifiants qu'elle place, triés par
 *                                    identifiant croissant
 * @property {TourDePlacement[]} placement
 *
 * @typedef {Object} Retenu   le placement en vigueur ; une retouche à la
 *                            main le modifie, jamais la proposition d'origine.
 *                            Un retenu que cette forme refuse, la lecture
 *                            l'admet et le contrôle des placements le garde
 *                            en le signalant (§ 8.9, point 3) : canonique.js
 *                            l'écrit compact à la clé retenu, ses clés
 *                            rangées, ses listes dans l'ordre écrit
 * @property {number} proposition     id de la proposition d'origine, sous
 *                                    prochainsIds.proposition
 * @property {boolean} siegesAttribues
 * @property {number[]} tables
 * @property {number[]} capacites
 * @property {number} tours
 * @property {number[]} participants  triés par identifiant croissant
 * @property {TourDePlacement[]} placement
 */

/**
 * Ce que rend analyser.
 *
 * @typedef {Object} Lecture
 * @property {Entete} entete
 * @property {Charge} charge              telle que le texte la porte ;
 *                                        réduite aux clés connues quand le
 *                                        format est plus récent
 * @property {boolean} formatPlusRecent   format > FORMAT : lecture seule
 */

/**
 * Une règle de SCHEMA, qui décrit une valeur du fichier d'état.
 *
 * @typedef {Object} Regle
 * @property {'objet'|'liste'|'chaine'|'entier'|'nombre'|'booleen'|'parmi'|'date'} genre
 *           chaine : non vide ; nombre : fini ; parmi : l'une de valeurs ;
 *           date : AAAA-MM-JJ d'un jour du calendrier
 * @property {boolean} nul                   null est admis
 * @property {Array<[string, Regle]>} [champs]   objet : ses champs, dans
 *           l'ordre des clés du texte canonique
 * @property {Set<string>} [cles]            objet : les clés de ses champs
 * @property {Regle} [element]               liste : la règle de ses éléments
 * @property {number} [min]                  entier : bornes incluses
 * @property {number} [max]
 * @property {string[]} [valeurs]            parmi
 * @property {'lignes'|'ouverte'} [mise]     absente : la valeur s'écrit
 *           compacte. lignes : un champ, ou un élément, par ligne. ouverte :
 *           l'objet s'écrit compact sur la ligne qui l'ouvre, chaque champ
 *           selon sa propre mise
 * @property {function(*, *): number} [tri]  liste : ordre canonique de ses
 *           éléments, total, qui compare leurs copies canoniques
 * @property {function(*, *): number} [triSansAttribution]   liste : ordre
 *           canonique quand l'objet qui porte le placement a
 *           siegesAttribues faux
 * @property {boolean} [aPart]               la lecture du document n'en
 *           contrôle que le conteneur ; le contenu se contrôle à part
 *           (placements.js)
 */

/**
 * Le journal, <base>.gtt-journal.jsonl (§ 8.2, § 8.3, § 8.6) : un objet JSON
 * par ligne, clés dans l'ordre écrit ici, fin de ligne LF. La première ligne
 * l'apparie à son état ; suivent des entrées et des jalons, dont l'ordre est
 * celui des lignes, jamais celui des horodatages.
 *
 * @typedef {Object} LigneOuverture
 * @property {'journal'} type
 * @property {number} format
 * @property {string} evenement     id de l'événement
 *
 * @typedef {Object} LigneEntree
 * @property {'entree'} type
 * @property {number} revision      la suivante, consécutive
 * @property {string} libelle       texte figé à l'écriture, jamais un code
 * @property {string} horodatage    AAAA-MM-JJTHH:MM:SS±HH:MM, pour l'affichage
 * @property {null|'defaire'|'refaire'|'revenir'} sens   null pour un geste
 * @property {number|null} retour   révision visée par une entrée de retour
 * @property {string|null} produitVersion   non nul à la première entrée et à
 *           chaque entrée dont la construction diffère de la précédente
 * @property {Charge|null} instantane   la charge résultante, quand la
 *           révision ouvre un intervalle : la première entrée du journal,
 *           puis toutes les INTERVALLE_INSTANTANE révisions comptées depuis
 *           elle
 * @property {Array<Object>|null} correctif   sinon : le correctif depuis la
 *           charge de l'entrée précédente dans l'ordre des lignes
 *
 * @typedef {Object} LigneJalon   nomme l'instant d'une révision ; ne change
 *                                pas la charge, ne prend pas de révision
 * @property {'jalon'} type
 * @property {number} revision
 * @property {string} nom
 * @property {string} horodatage
 *
 * Fil courant (§ 8.3) : la position d'une entrée ordinaire est elle-même,
 * celle d'une entrée de retour la position de l'entrée qu'elle vise. Le
 * rejeu des lignes tient une position et une pile : une entrée ordinaire
 * pose la position et vide la pile ; un retour defaire ou revenir empile la
 * position courante et pose celle de sa cible ; un retour refaire dépile.
 * Défaire vise la position de l'entrée qui précède, dans l'ordre des lignes,
 * l'entrée de la position courante ; refaire vise le sommet de la pile, et
 * n'existe que si elle n'est pas vide. Le fil courant est la chaîne des
 * positions remontée depuis la position courante ; les autres entrées
 * ordinaires forment des fils abandonnés.
 *
 * Lecture : la première ligne illisible — JSON invalide, forme fausse,
 * révision non consécutive, ligne finale sans fin de ligne — arrête la
 * lecture ; elle et tout ce qui la suit sont écartés et comptés (§ 8.6).
 * Élagage : au-delà de PLAFOND_ENTREES entrées, le journal se réécrit à
 * partir de la frontière d'instantané la plus récente qui en garde au moins
 * PLANCHER_ENTREES ; les jalons des entrées retirées partent avec elles.
 */

/**
 * Fichiers voisins d'un événement, nommés par un suffixe ajouté à sa base :
 * .gtt.json, l'état ; .gtt.json.precedent, l'état d'avant le dernier geste
 * (§ 8.8) ; .gtt-journal.jsonl, le journal ; .gtt.verrou, présent tant
 * qu'une séance est en écriture ; .ecriture, ajouté au nom d'un fichier
 * pendant son écriture atomique. Le dossier de travail porte aussi
 * reglages_locaux.json (§ 8.5) et corbeille/AAAA-MM-JJ_HH-MM-SS/ (§ 8.7).
 *
 * @typedef {Object} ContenuVerrou   contenu de .gtt.verrou
 * @property {string} seance
 * @property {number} pid
 * @property {string} hote
 * @property {string} depuis
 *
 * @typedef {Object} ReglagesLocaux   reglages_locaux.json
 * @property {number} format
 * @property {null|'A4'|'Lettre'} papier
 * @property {Array<{evenement: string, k: number, tx: number, ty: number}>} cadrages
 *           triés par identifiant d'événement
 */

/**
 * Codes d'une ErreurStockage, et ses détails :
 *
 *   ABSENT               {chemin}                    lecture d'un fichier qui
 *                                                    n'existe pas
 *   ECRITURE             {chemin, dossier, cause}    une écriture, un ajout, un
 *                                                    renommage refusés ; la
 *                                                    cible est intacte
 *   EXISTE               {chemin}                    déplacer vers une cible
 *                                                    existante
 *   CHEMIN_REFUSE        {chemin}                    chemin absolu, .., racine
 *                                                    inconnue
 *   ETAT_ILLISIBLE       DetailsIllisible            un fichier d'état qui ne
 *                                                    se lit pas
 *   CORRECTIF            {rang}                      un correctif qui ne
 *                                                    s'applique pas
 *   CHEMIN_TROP_LONG     {racine}                    aucune base ne tient sous
 *                                                    la borne (§ 8.6)
 *   IDENTIFIANT_PRESENT  {id, base}                  importer un événement dont
 *                                                    l'identifiant est déjà
 *                                                    dans le dossier
 *   VERROU_PRIS          {seance, depuis, vivant}    passer en écriture quand
 *                                                    une autre séance tient le
 *                                                    verrou
 *   LECTURE_SEULE        {raison}                    un geste sur un fichier
 *                                                    d'un format plus récent,
 *                                                    ou sur un plan bloqué
 *   ETAT_NON_ECRIT       {chemin, dossier, cause}    le geste est au journal,
 *                                                    l'état n'a pas pu s'écrire
 *                                                    (§ 8.2)
 *   CORBEILLE_SATUREE    {dossier}                   cent suppressions dans la
 *                                                    même seconde : le rang de
 *                                                    collision dépasserait les
 *                                                    deux chiffres que la borne
 *                                                    réserve (§ 8.7)
 *
 * @typedef {'ABSENT'|'VIDE'|'JSON'|'FORME'|'COMPTES'|'REFERENCE'|'FORMAT_INCONNU'|'FORMAT_PLUS_RECENT'} RaisonIllisible
 *   ABSENT          le journal existe sans l'état ; posée par le dépôt, jamais
 *                   par analyser
 *   VIDE            zéro octet, ou des blancs seulement
 *   JSON            le texte n'est pas du JSON
 *   FORME           type, clé manquante ou inconnue, valeur hors de son
 *                   domaine, identifiant de participant ou de table en
 *                   double ou atteignant prochainsIds, tour d'une
 *                   réservation hors de sa portée ; des propositions et du
 *                   retenu, seul le conteneur
 *   COMPTES         un compte de l'en-tête contredit sa liste
 *   REFERENCE       réservation ou titre vers une table ou une personne
 *                   absente, siège au-delà de la capacité
 *   FORMAT_INCONNU  format présent, mais non entier ou < 1
 *   FORMAT_PLUS_RECENT  format > FORMAT : ses clés inconnues sont ignorées,
 *                   et une faute qui serait FORME au format courant porte
 *                   cette raison ; COMPTES et REFERENCE gardent la leur, une
 *                   corruption quel que soit le format ; tout refus d'un tel
 *                   fichier porte le format lu
 *
 * @typedef {Object} DetailsIllisible
 * @property {string} base             base de l'événement
 * @property {RaisonIllisible} raison
 * @property {string|null} chemin      premier élément fautif, par exemple
 *           charge.participants[2].nom : clés séparées par un point, rangs
 *           entre crochets, une clé qui ne s'écrit pas comme un identifiant
 *           entre crochets en JSON ; '' pour la racine ; null quand rien ne se
 *           désigne (ABSENT, VIDE, JSON)
 * @property {number} [format]         le format lu quand il dépasse FORMAT :
 *           FORMAT_PLUS_RECENT, et COMPTES ou REFERENCE d'un fichier plus
 *           récent
 * @property {{precedent: number|null, journal: number|null}} secours
 *           révision lisible du .precedent et dernier instant du journal ;
 *           null pour ce qui ne se lit pas
 *
 * analyser ne connaît que le texte : il lève {raison, chemin}, et format
 * pour un fichier plus récent, que le dépôt complète de base et de secours.
 */

/**
 * Codes d'une faute de placement, que rendent fautes et examiner
 * (placements.js, Faute), et ses détails. Une proposition fautive s'écarte
 * à l'ouverture, et le fichier s'ouvre sans elle ; un retenu fautif est
 * signalé et gardé (§ 8.9, point 3). Les raisons de dérive d'un placement
 * cohérent sont décrites avec derive (placements.js, Raison).
 *
 *   FORME               {chemin}          une valeur sort de sa règle, ou la
 *                                         déclaration se contredit ; chemin
 *                                         dans le placement, '' pour lui-même
 *   LONGUEUR            {tour, table,     une longueur écrite contredit celle
 *                        declare, ecrit}  que le placement déclare : nombre de
 *                                         tours (tour et table null), de listes
 *                                         d'un tour (table null), liste d'une
 *                                         table au-delà de sa capacité
 *   DOUBLON             {tour,            un identifiant écrit plus d'une fois
 *                        participant}     dans un tour, réserve comprise
 *   INCONNU             {tour,            un identifiant écrit sans être
 *                        participant}     déclaré
 *   MANQUANT            {tour,            un identifiant déclaré sans être
 *                        participant}     écrit
 *   IDENTIFIANT_REPETE  {}                une proposition cohérente porte
 *                                         l'identifiant d'une proposition
 *                                         gardée avant elle dans la liste ;
 *                                         examiner seul la nomme, et l'entrée
 *                                         de fautives porte son rang et son id
 *   IDENTIFIANT_HORS_COMPTEUR
 *                       {}                une proposition cohérente porte un
 *                                         identifiant qui atteint
 *                                         prochainsIds.proposition, ou le
 *                                         retenu cohérent une proposition
 *                                         d'origine qui l'atteint ; examiner
 *                                         seul la nomme : la proposition
 *                                         s'écarte, le retenu reste et garde
 *                                         ses raisons de dérive ; la charge
 *                                         qu'examiner rend relève le compteur
 *                                         au-delà de l'identifiant, qui ne se
 *                                         réattribue pas
 */
