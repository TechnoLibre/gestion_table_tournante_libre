<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La section de l'impression (§ 2.1 étape 12, § 11.2, § 11.6, § 11.7,
  // § 11.8, Q1, Q3), que la navigation nomme « Impression », en deux
  // parties titrées. Sous « Badges », la planche de badges, un PDF à
  // imprimer et à couper, la liste des mêmes badges en CSV, et la
  // réédition ; sous « Plan », l'aperçu avant impression du plan, de la
  // liste d'accueil et de la feuille par table (Apercu.svelte), le seul
  // endroit d'où l'on imprime. Produire n'est pas modifier (§ 8.4, § 11.6) :
  // la section vit en lecture comme sur un plan bloqué, et la séance
  // n'écrit que le PDF, le CSV et, pour le papier, le modèle, les cases et
  // les colonnes de la liste, reglages_locaux.json — ni l'état ni le
  // journal, sauf l'image des badges, réglage de l'événement, dont chaque
  // geste est une entrée.
  //
  // Le modèle de badge est un réglage de la machine (EtatSeance.modeleBadge,
  // seance.choisirModeleBadge), Avery 5392 tant que l'opérateur n'en a pas
  // choisi. Un modèle que la machine ne retient pas — les réglages locaux
  // ne s'écrivent pas — vaut pour la séance, et une annonce le dit sous les
  // réglages tant qu'il est celui de la séance. Un modèle qui impose son
  // papier — Avery 5392, sur Lettre — ne montre ni l'imposition ni le
  // papier ; l'A6 montre les deux. Aucune production ne pose la question du
  // papier : l'A6 prend celui de la machine, Lettre tant qu'elle n'en a pas
  // (PAPIER_BADGES_DEFAUT), montré comme un papier choisi, que « Changer »
  // remplace pour la machine.
  //
  // La case du pied TechnoLibre est un autre réglage de la machine
  // (EtatSeance.piedTechnolibre, seance.choisirPiedTechnolibre), cochée tant
  // que l'opérateur ne l'a pas décochée, sous les deux modèles. Une case que
  // la machine ne retient pas vaut pour la séance, et une annonce le dit
  // sous les réglages tant qu'elle est celle de la séance, comme le modèle.
  //
  // Sous la case, un champ de quelques lignes porte le texte de ce pied, autre
  // réglage de la machine (EtatSeance.textePiedTechnolibre,
  // seance.choisirTextePiedTechnolibre), prérempli de la phrase d'origine
  // (TEXTE_PIED_TECHNOLIBRE_DEFAUT) ; la case décochée le désactive. La frappe
  // ne vit que dans le champ, en brouillon ; le texte s'écrit quand le champ se
  // quitte — l'événement change —, normalisé, et seulement quand il diffère de
  // celui de la séance. Le brouillon est une saisie non validée : un geste
  // ouvert (geste.js), qui suspend le compte d'inactivité de la séance (§ 8.4).
  // « Texte par défaut » remet la phrase d'origine ; il est désactivé quand le
  // champ la porte déjà, à la normalisation près, ou que la case est décochée.
  // Un texte que la machine ne retient pas s'annonce tant qu'il est celui de la
  // séance, comme la case.
  //
  // À côté d'elle, dans le même groupe, cinq cases de la machine disent ce
  // que le badge imprime en plus du nom et des tours, une par donnée de
  // DONNEES_BADGE (EtatSeance.donneesBadge, seance.choisirDonneeBadge),
  // cochées tant que l'opérateur ne les a pas décochées. Chaque écriture ne
  // porte que sa case : une case que la machine ne retient pas le reste
  // jusqu'à ce qu'un choix de CETTE case soit retenu, quoi qu'il advienne
  // des autres, et l'annonce le dit tant qu'une case non retenue garde dans
  // la séance la valeur choisie.
  //
  // Sous elles, la case « Organisation en gros, au-dessus du nom », autre
  // réglage de la machine (EtatSeance.organisationEnGros,
  // seance.choisirOrganisationEnGros), cochée tant que l'opérateur ne l'a
  // pas décochée : le badge d'une personne qui a une organisation la pose en
  // gros, et le nom en petit sous elle. Elle est désactivée tant que la case
  // « Organisation » est décochée, aucune organisation ne s'imprimant. Une
  // case que la machine ne retient pas s'annonce tant qu'elle est celle de
  // la séance, comme celle du pied.
  //
  // Juste avant la case du pied TechnoLibre, la case « Laisser le nom des
  // doublons en blanc », autre réglage de la machine (EtatSeance.cacherNumero,
  // seance.choisirCacherNumero), cochée tant que l'opérateur ne l'a pas
  // décochée : le badge d'une personne que l'import a numérotée garde la
  // place de son nom, vide, pour l'écrire à la main, ce que dit la note
  // sous la case. Une case que la machine ne retient pas s'annonce tant
  // qu'elle est celle de la séance, comme celle du pied.
  //
  // Sous le groupe des cases, l'image sur tous les badges
  // (ImageBadges.svelte), un réglage de l'événement et non du poste : sa
  // case, son image et sa position s'écrivent dans le fichier d'état, en
  // écriture seulement, et la charge qui change retire l'annonce montrée.
  //
  // Les réglages d'une demande : la source — le retenu s'il existe, sinon la
  // proposition demandée au plan depuis les propositions, choisie quand les
  // deux sont offertes (sourcesOffertes) —, l'imposition, feuille par
  // feuille par défaut, et l'ordre, alphabétique par défaut. Aucun n'est un
  // réglage local : ils valent pour la section ouverte.
  //
  // « Préparer » demande l'annonce à la séance (preparerPlanche) et la montre,
  // phrase par phrase (phrasesAnnonce), avec son refus et le remède de
  // celui-ci. L'annonce montrée est celle des réglages, du modèle, du papier,
  // des cases, du texte du pied TechnoLibre et de la charge courants : qu'un
  // d'eux change, elle se retire, et la suivante se prépare. « Produire »
  // prépare d'abord : une dérive, et tout refus du placement ou de la mise en
  // page, se nomme avant toute production (§ 11.8), et « Produire » reste
  // désactivé, expliqué, tant que l'annonce montrée le porte. Un papier choisi
  // par « Changer » (Papier.svelte) prépare de nouveau l'annonce montrée.
  //
  // La planche produite nomme son chemin — dans le dossier de l'événement
  // —, ou, sous web, où elle se télécharge, son nom ; pour Avery 5392, ceux
  // de la feuille de contrôle à part suivent. « Ouvrir le dossier » se
  // tient parmi les commandes en tout temps, avant comme après une
  // production, quand la plateforme a un explorateur (facade.explorateur) :
  // il montre par la séance (ouvrirDossierEvenement) le dossier de
  // l'événement, où la planche se dépose, sous la racine de l'événement
  // ouvert, écriture ailleurs comprise, et jamais le chemin choisi par
  // « Enregistrer sous… » ; un dossier qui ne se trouve plus se refuse à
  // côté de la commande. Une écriture refusée se dit PLANCHE_NON_ECRITE,
  // remède « Enregistrer sous… » (enregistrerPlancheSous), dont les chemins
  // choisis — pour Avery 5392, celui de la feuille de contrôle aussi —
  // remplacent ceux de la planche.
  //
  // Les colonnes de la liste des badges en CSV sont un autre réglage de la
  // machine (EtatSeance.colonnesListe, seance.choisirColonnesListe), choisi
  // parmi les réglages : une colonne par tour tant que l'opérateur n'a pas
  // choisi « Une seule colonne ». La planche ne les lit pas : l'annonce
  // montrée reste. Un choix que la machine ne retient pas s'annonce tant
  // qu'il est celui de la séance, comme le modèle.
  //
  // « Produire la liste (CSV) » dépose la liste de la demande courante
  // (produireListeBadges) et nomme son chemin, ou son nom sous web. Elle ne
  // prépare pas l'annonce : seuls les refus du placement la gardent, levés
  // par la séance à côté de la commande ; quand l'annonce montrée en porte
  // un, la commande est désactivée et expliquée (listeBloquee). Une écriture
  // refusée offre « Enregistrer sous… » (enregistrerListeBadgesSous), dont
  // le chemin choisi remplace celui de la liste.
  //
  // La réédition (Reedition.svelte) passe par la même production, sa
  // sélection dans la demande.
  //
  // Préparer, produire et « Enregistrer sous… » passent par l'indicateur
  // d'activité (activite.js) : l'annonce, la planche et la liste se
  // calculent sur le fil du rendu.
  //
  // Habillage : chaque partie est une région nommée par son titre. Les
  // réglages, le papier, les commandes, l'annonce et les fichiers produits
  // vivent dans la carte de la planche ; « Produire la planche (PDF) » en
  // est l'action principale. L'annonce se pose sur le fond sourd de la
  // carte, les fichiers produits sur le fond de l'information. La réédition
  // est une carte à elle.
  import { getContext, onDestroy } from 'svelte';
  import { COLONNES_LISTE_BADGES, DONNEES_BADGE, TEXTE_PIED_TECHNOLIBRE_DEFAUT, normaliserTextePied } from '../../application/seance.js';
  import { PAPIER_BADGES_DEFAUT } from '../../geometrie/papiers.js';
  import Message from '../accueil/Message.svelte';
  import { suivre } from '../activite.js';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import { creerGeste } from '../primitives/geste.js';
  import Refus from '../primitives/Refus.svelte';
  import Apercu from '../impression/Apercu.svelte';
  import Papier from '../sorties/Papier.svelte';
  import ImageBadges from './ImageBadges.svelte';
  import Reedition from './Reedition.svelte';
  import {
    IMPOSITIONS_OFFERTES,
    MODELES_OFFERTS,
    ORDRES_OFFERTS,
    annonceDeLaMachine,
    cleImposition,
    cleModele,
    cleOrdre,
    cleSource,
    libelleSource,
    listeBloquee,
    memesReglages,
    modeleImposeSonPapier,
    phrasesAnnonce,
    produireBloque,
    sourceChoisie,
    sourcesOffertes,
  } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');
  const facade = getContext('facade');
  const uid = $props.id();

  const charge = $derived($seance.charge);
  const modeleBadge = $derived($seance.modeleBadge);
  const piedTechnolibre = $derived($seance.piedTechnolibre);
  const textePiedTechnolibre = $derived($seance.textePiedTechnolibre);
  const donneesBadge = $derived($seance.donneesBadge);
  const cacherNumero = $derived($seance.cacherNumero);
  const organisationEnGros = $derived($seance.organisationEnGros);
  const colonnesListe = $derived($seance.colonnesListe);
  const cartes = $derived(modeleImposeSonPapier(modeleBadge));
  const offertes = $derived(charge === null ? [] : sourcesOffertes(charge, $ui.proposition));

  // La clé de la source que l'opérateur a choisie, null avant tout choix.
  let cleChoisie = $state(null);
  let imposition = $state(IMPOSITIONS_OFFERTES[0]);
  let ordre = $state(ORDRES_OFFERTS[0]);
  const source = $derived(sourceChoisie(offertes, cleChoisie));

  // La demande des réglages courants, avec la sélection d'une réédition,
  // null pour toute la soirée.
  const demandeDe = (selection) => ({ source: source.source, proposition: source.proposition, imposition, ordre, selection });

  // Vrai quand l'annonce a lu les cases de la séance ; une annonce sans
  // cases les a lues toutes cochées.
  const memesDonnees = (annonce) => DONNEES_BADGE.every((donnee) => (annonce.donneesBadge?.[donnee] ?? true) === donneesBadge[donnee]);
  // Vrai quand l'annonce a lu le texte du pied TechnoLibre de la séance ;
  // une annonce sans texte a lu la phrase d'origine.
  const memeTexte = (annonce) => (annonce.textePiedTechnolibre ?? TEXTE_PIED_TECHNOLIBRE_DEFAUT) === textePiedTechnolibre;

  // La dernière annonce préparée : {annonce, demande, charge}, la charge lue
  // au départ de la préparation. Montrée tant que réglages, modèle, papier,
  // cases et charge sont ceux qu'elle a lus. Gardée telle quelle, sans
  // mandataire réactif : la charge se compare par identité à celle de la
  // séance.
  let preparee = $state.raw(null);
  const montree = $derived(
    preparee !== null &&
      preparee.charge === charge &&
      annonceDeLaMachine(preparee.annonce, $seance) &&
      memesDonnees(preparee.annonce) &&
      memeTexte(preparee.annonce) &&
      memesReglages(preparee.demande, demandeDe(null))
      ? preparee
      : null,
  );
  const phrases = $derived(montree === null ? [] : phrasesAnnonce(montree.annonce, montree.demande));
  const bloque = $derived(montree !== null && produireBloque(montree.annonce));
  const listeEnRefus = $derived(montree !== null && listeBloquee(montree.annonce));

  // La planche produite : {chemin, nom, controle}, chemin null sous web ;
  // controle, la feuille de contrôle à part, {chemin, nom}, ou null.
  let produite = $state(null);
  // La demande de la dernière production, que « Enregistrer sous… » reprend.
  let derniere = null;
  // Le refus de l'annonce préparée de nouveau après le choix du papier, que
  // nulle commande ne porte.
  let refusRepris = $state(null);
  // La liste produite : {chemin, nom}, chemin null sous web ; et la demande
  // de la dernière, que son « Enregistrer sous… » reprend.
  let liste = $state(null);
  let derniereListe = null;
  // Le dernier modèle choisi que la machine n'a pas retenu, ou null ; de
  // même, la dernière valeur de la case du pied TechnoLibre, celle de la
  // case du nom des doublons, celle de l'organisation en gros, et les
  // dernières colonnes de la liste.
  let modeleNonRetenu = $state(null);
  let piedNonRetenu = $state(null);
  let cacherNonRetenu = $state(null);
  let enGrosNonRetenu = $state(null);
  let colonnesNonRetenues = $state(null);
  // Les cases que la machine n'a pas retenues, chacune avec la valeur de son
  // dernier choix : une donnée y entre quand son choix n'est pas retenu, en
  // sort quand un choix d'elle l'est. Vide tant que tout est retenu.
  let donneesNonRetenues = $state.raw({});
  // Le dernier texte du pied TechnoLibre que la machine n'a pas retenu,
  // normalisé, ou null.
  let texteNonRetenu = $state(null);
  // Le texte que la frappe pose dans le champ avant qu'il ne se quitte, ou
  // null : le champ montre alors le texte de la séance.
  let brouillon = $state(null);
  const texteMontre = $derived(brouillon ?? textePiedTechnolibre);
  const gesteTexte = creerGeste(seance);
  $effect(() => gesteTexte.tenir(brouillon !== null));
  onDestroy(() => gesteTexte.liberer());
  const texteDejaDefaut = $derived(normaliserTextePied(texteMontre) === TEXTE_PIED_TECHNOLIBRE_DEFAUT);
  // Vrai quand une case non retenue garde, dans la séance, la valeur choisie.
  const annoncerDonnees = $derived(
    DONNEES_BADGE.some((donnee) => Object.hasOwn(donneesNonRetenues, donnee) && donneesNonRetenues[donnee] === donneesBadge[donnee]),
  );

  async function preparer(selection) {
    const demande = demandeDe(selection);
    const lue = seance.etat().charge;
    const annonce = await suivre(() => seance.preparerPlanche(demande));
    preparee = { annonce, demande, charge: lue };
    return { annonce, demande };
  }

  async function produire(selection) {
    // Une nouvelle production efface la planche montrée : un refus ne se
    // pose jamais à côté du chemin d'une production précédente.
    refusRepris = null;
    produite = null;
    const { annonce, demande } = await preparer(selection);
    if (produireBloque(annonce)) return;
    derniere = demande;
    try {
      produite = await suivre(() => seance.produirePlanche(demande));
    } catch (erreur) {
      montrerCartesDeposees(erreur);
      throw erreur;
    }
  }

  // La feuille de contrôle refusée après les cartes : le chemin des cartes
  // écrites (deposee) se montre comme celui d'une planche produite, et le
  // refus remonte ensuite à son remède.
  function montrerCartesDeposees(erreur) {
    const deposee = erreur?.code === 'PLANCHE_NON_ECRITE' ? (erreur.details?.deposee ?? null) : null;
    if (deposee !== null) produite = { chemin: deposee, nom: null, controle: null };
  }

  // Le papier choisi par la question de la section : l'annonce montrée se
  // prépare de nouveau. Un refus de cette préparation se pose sous les
  // commandes.
  async function papierChoisi() {
    try {
      if (preparee !== null) await preparer(preparee.demande.selection);
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusRepris = { code: erreur.code, details: erreur.details ?? {} };
    }
  }

  // Le remède que la section exécute : l'enregistrement ailleurs de la
  // dernière planche demandée. Les chemins choisis remplacent ceux de la
  // planche et de sa feuille de contrôle à part ; null quand l'opérateur
  // annule.
  const gestes = {
    enregistrerSous: async () => {
      let choisis;
      try {
        choisis = await suivre(() => seance.enregistrerPlancheSous(derniere));
      } catch (erreur) {
        montrerCartesDeposees(erreur);
        throw erreur;
      }
      if (choisis === null) return null;
      const controle = choisis.controle === null ? null : { chemin: choisis.controle, nom: null };
      produite = { chemin: choisis.chemin, nom: null, controle };
      return choisis.chemin;
    },
  };

  // La liste des réglages courants, toute la soirée. Une nouvelle
  // production efface la liste montrée.
  async function produireLaListe() {
    liste = null;
    const demande = demandeDe(null);
    derniereListe = demande;
    liste = await suivre(() => seance.produireListeBadges(demande));
  }

  // Le remède d'une liste refusée d'écriture : son enregistrement ailleurs,
  // dont le chemin choisi remplace celui de la liste.
  const gestesListe = {
    enregistrerSous: async () => {
      const chemin = await suivre(() => seance.enregistrerListeBadgesSous(derniereListe));
      if (chemin !== null) liste = { chemin, nom: null };
      return chemin;
    },
  };

  const explorateur = facade.explorateur();

  // Le modèle choisi s'écrit sur la machine ; l'état de la séance le porte
  // aussitôt. Un choix que la machine ne retient pas s'annonce, sans
  // bloquer le choix.
  async function choisirModele(modele) {
    const { retenu } = await seance.choisirModeleBadge(modele);
    modeleNonRetenu = retenu ? null : modele;
  }

  // La case cochée ou décochée s'écrit sur la machine, comme le modèle.
  async function choisirPied(coche) {
    const { retenu } = await seance.choisirPiedTechnolibre(coche);
    piedNonRetenu = retenu ? null : coche;
  }

  // La case du nom des doublons s'écrit sur la machine, comme celle du
  // pied TechnoLibre.
  async function choisirCacher(coche) {
    const { retenu } = await seance.choisirCacherNumero(coche);
    cacherNonRetenu = retenu ? null : coche;
  }

  // La case de l'organisation en gros s'écrit sur la machine, comme celle
  // du pied TechnoLibre.
  async function choisirEnGros(coche) {
    const { retenu } = await seance.choisirOrganisationEnGros(coche);
    enGrosNonRetenu = retenu ? null : coche;
  }

  // Les colonnes de la liste s'écrivent sur la machine, comme le modèle.
  async function choisirColonnes(colonnes) {
    const { retenu } = await seance.choisirColonnesListe(colonnes);
    colonnesNonRetenues = retenu ? null : colonnes;
  }

  // Le texte quitté s'écrit sur la machine, comme la case, quand sa forme
  // normalisée diffère de celui de la séance ; le champ montre ensuite le
  // texte de la séance, normalisé. Quitter le champ sans changement — une
  // frappe défaite, qui ne lève pas change — jette aussi le brouillon : le
  // champ suit alors le texte de la séance, même relu entre-temps.
  async function retenirTexte(valeur) {
    brouillon = null;
    if (normaliserTextePied(valeur) === textePiedTechnolibre) return;
    const { retenu } = await seance.choisirTextePiedTechnolibre(valeur);
    texteNonRetenu = retenu ? null : normaliserTextePied(valeur);
  }

  // La case d'une donnée du badge s'écrit sur la machine, comme celle du
  // pied TechnoLibre ; son issue ne touche que l'entrée de cette donnée
  // parmi les non retenues.
  async function choisirDonnee(donnee, coche) {
    const { retenu } = await seance.choisirDonneeBadge(donnee, coche);
    const { [donnee]: _, ...autres } = donneesNonRetenues;
    donneesNonRetenues = retenu ? autres : { ...autres, [donnee]: coche };
  }
</script>

<section data-section="badges">
  <h2>{t('coquille.section.badges')}</h2>

  <section class="partie" data-partie-impression="badges" aria-labelledby={`${uid}-partie-badges`}>
    <h3 id={`${uid}-partie-badges`}>{t('badges.partie.badges')}</h3>
    <p>{t('badges.introduction')}</p>

    {#if charge !== null}
      <Carte titre={t('badges.planche.titre')} niveau={4}>
        <div class="planche">
          <div class="reglages">
            <label class="reglage">
              <span>{t('badges.modele.titre')}</span>
              <select data-champ="modeleBadge" value={modeleBadge} onchange={(evenement) => choisirModele(evenement.currentTarget.value)}>
                {#each MODELES_OFFERTS as valeur (valeur)}
                  <option value={valeur}>{t(cleModele(valeur))}</option>
                {/each}
              </select>
            </label>
            {#if offertes.length > 1}
              <label class="reglage">
                <span>{t('badges.source.titre')}</span>
                <select data-champ="source" value={cleSource(source)} onchange={(evenement) => (cleChoisie = evenement.currentTarget.value)}>
                  {#each offertes as offerte (cleSource(offerte))}
                    <option value={cleSource(offerte)}>{t(libelleSource(offerte).cle, libelleSource(offerte).details)}</option>
                  {/each}
                </select>
              </label>
            {/if}
            {#if !cartes}
              <label class="reglage">
                <span>{t('badges.imposition.titre')}</span>
                <select data-champ="imposition" value={imposition} onchange={(evenement) => (imposition = evenement.currentTarget.value)}>
                  {#each IMPOSITIONS_OFFERTES as valeur (valeur)}
                    <option value={valeur}>{t(cleImposition(valeur))}</option>
                  {/each}
                </select>
              </label>
            {/if}
            <label class="reglage">
              <span>{t('badges.ordre.titre')}</span>
              <select data-champ="ordre" value={ordre} onchange={(evenement) => (ordre = evenement.currentTarget.value)}>
                {#each ORDRES_OFFERTS as valeur (valeur)}
                  <option value={valeur}>{t(cleOrdre(valeur))}</option>
                {/each}
              </select>
            </label>
            <label class="reglage">
              <span>{t('badges.liste.colonnes.titre')}</span>
              <select data-champ="colonnesListe" value={colonnesListe} onchange={(evenement) => choisirColonnes(evenement.currentTarget.value)}>
                {#each COLONNES_LISTE_BADGES as valeur (valeur)}
                  <option value={valeur}>{t(`badges.liste.colonnes.${valeur}`)}</option>
                {/each}
              </select>
            </label>
          </div>
          <div class="cases" role="group" aria-labelledby={`${uid}-cases`}>
            <p class="intitule" id={`${uid}-cases`}>{t('badges.donnees.titre')}</p>
            <div class="rangee">
              {#each DONNEES_BADGE as donnee (donnee)}
                <div class="case">
                  <input
                    id={`${uid}-donnee-${donnee}`}
                    type="checkbox"
                    data-champ={`donneeBadge.${donnee}`}
                    checked={donneesBadge[donnee]}
                    onchange={(evenement) => choisirDonnee(donnee, evenement.currentTarget.checked)}
                  />
                  <label for={`${uid}-donnee-${donnee}`}>{t(`badges.donnees.${donnee}`)}</label>
                </div>
              {/each}
            </div>
            <div class="case">
              <input
                id={`${uid}-en-gros`}
                type="checkbox"
                data-champ="organisationEnGros"
                checked={organisationEnGros}
                disabled={!donneesBadge.organisation}
                onchange={(evenement) => choisirEnGros(evenement.currentTarget.checked)}
              />
              <label for={`${uid}-en-gros`}>{t('badges.organisationEnGros.case')}</label>
            </div>
            <div class="case-notee">
              <div class="case">
                <input
                  id={`${uid}-doublons`}
                  type="checkbox"
                  data-champ="cacherNumero"
                  checked={cacherNumero}
                  aria-describedby={`${uid}-doublons-note`}
                  onchange={(evenement) => choisirCacher(evenement.currentTarget.checked)}
                />
                <label for={`${uid}-doublons`}>{t('badges.doublons.case')}</label>
              </div>
              <p class="aide note" id={`${uid}-doublons-note`}>{t('badges.doublons.note')}</p>
            </div>
            <div class="case">
              <input
                id={`${uid}-technolibre`}
                type="checkbox"
                data-champ="piedTechnolibre"
                checked={piedTechnolibre}
                onchange={(evenement) => choisirPied(evenement.currentTarget.checked)}
              />
              <label for={`${uid}-technolibre`}>{t('badges.technolibre.case')}</label>
            </div>
            <div class="texte-pied">
              <label for={`${uid}-texte-pied`}>{t('badges.technolibre.texte')}</label>
              <textarea
                id={`${uid}-texte-pied`}
                data-champ="textePiedTechnolibre"
                rows="3"
                value={texteMontre}
                disabled={!piedTechnolibre}
                aria-describedby={`${uid}-texte-pied-aide`}
                oninput={(evenement) => (brouillon = evenement.currentTarget.value)}
                onchange={(evenement) => retenirTexte(evenement.currentTarget.value)}
                onblur={() => (brouillon = null)}
              ></textarea>
              <p class="aide" id={`${uid}-texte-pied-aide`}>{t('badges.technolibre.texteAide')}</p>
              <button
                type="button"
                class="defaut"
                data-commande="texteParDefaut"
                disabled={!piedTechnolibre || texteDejaDefaut}
                onclick={() => retenirTexte(TEXTE_PIED_TECHNOLIBRE_DEFAUT)}>{t('badges.technolibre.texteDefaut')}</button
              >
            </div>
          </div>
          <ImageBadges {charge} />
          <div role="status">
            {#if modeleNonRetenu !== null && modeleNonRetenu === modeleBadge}
              <Message ton="avis"><p data-avertissement="modeleNonRetenu">{t('badges.modele.nonRetenu')}</p></Message>
            {/if}
            {#if piedNonRetenu !== null && piedNonRetenu === piedTechnolibre}
              <Message ton="avis"><p data-avertissement="piedNonRetenu">{t('badges.technolibre.nonRetenu')}</p></Message>
            {/if}
            {#if enGrosNonRetenu !== null && enGrosNonRetenu === organisationEnGros}
              <Message ton="avis"><p data-avertissement="enGrosNonRetenu">{t('badges.organisationEnGros.nonRetenu')}</p></Message>
            {/if}
            {#if cacherNonRetenu !== null && cacherNonRetenu === cacherNumero}
              <Message ton="avis"><p data-avertissement="cacherNonRetenu">{t('badges.doublons.nonRetenu')}</p></Message>
            {/if}
            {#if texteNonRetenu !== null && texteNonRetenu === textePiedTechnolibre}
              <Message ton="avis"><p data-avertissement="texteNonRetenu">{t('badges.technolibre.texteNonRetenu')}</p></Message>
            {/if}
            {#if annoncerDonnees}
              <Message ton="avis"><p data-avertissement="donneesNonRetenues">{t('badges.donnees.nonRetenues')}</p></Message>
            {/if}
            {#if colonnesNonRetenues !== null && colonnesNonRetenues === colonnesListe}
              <Message ton="avis"><p data-avertissement="colonnesNonRetenues">{t('badges.liste.colonnes.nonRetenu')}</p></Message>
            {/if}
          </div>

          {#if !cartes}
            <Papier defaut={PAPIER_BADGES_DEFAUT} onChoisi={papierChoisi} />
          {/if}

          <div class="commandes">
            <Commande cle="badges.commande.preparer" nom="preparerPlanche" executer={() => preparer(null)} {gestes} />
            {#if bloque}
              <button type="button" data-commande="produirePlanche" aria-disabled="true" aria-describedby={`${uid}-bloque`}
                >{t('badges.commande.produire')}</button
              >
            {:else}
              <Commande cle="badges.commande.produire" nom="produirePlanche" variante="principale" executer={() => produire(null)} {gestes} />
            {/if}
            {#if listeEnRefus}
              <button type="button" data-commande="produireListe" aria-disabled="true" aria-describedby={`${uid}-liste`}
                >{t('badges.commande.produireListe')}</button
              >
            {:else}
              <Commande cle="badges.commande.produireListe" nom="produireListe" executer={produireLaListe} gestes={gestesListe} />
            {/if}
            {#if explorateur.disponible}
              <Commande cle="badges.commande.ouvrirDossier" nom="ouvrirDossier" executer={() => seance.ouvrirDossierEvenement()} />
            {/if}
          </div>
          {#if bloque}
            <p class="explication" id={`${uid}-bloque`}>{t('badges.produire.bloque')}</p>
          {/if}
          {#if listeEnRefus}
            <p class="explication" id={`${uid}-liste`}>{t('badges.liste.bloquee')}</p>
          {/if}
          {#if refusRepris !== null}
            <Refus refus={refusRepris} lever={() => (refusRepris = null)} {gestes} />
          {/if}

          {#if montree !== null}
            <div class="annonce" data-annonce-planche role="group" aria-labelledby={`${uid}-annonce`}>
              <h5 id={`${uid}-annonce`}>{t('badges.annonce.titre')}</h5>
              <ul>
                {#each phrases as phrase, rang (rang)}
                  <li>{t(phrase.cle, phrase.details)}</li>
                {/each}
              </ul>
              {#if montree.annonce.refus !== null}
                <Refus refus={montree.annonce.refus} {gestes} />
              {/if}
            </div>
          {/if}

          {#if produite !== null}
            <div class="produite">
              {#if produite.chemin !== null}
                <p>
                  <span>{t('badges.produite.chemin')}</span>
                  <span class="chemin" data-chemin-planche>{produite.chemin}</span>
                </p>
                {#if produite.controle !== null}
                  <p>
                    <span>{t('badges.produite.controle')}</span>
                    <span class="chemin" data-chemin-controle>{produite.controle.chemin}</span>
                  </p>
                {/if}
              {:else}
                <p data-chemin-planche>{t('badges.produite.telechargee', { nom: produite.nom })}</p>
                {#if produite.controle !== null}
                  <p data-chemin-controle>{t('badges.produite.controleTelechargee', { nom: produite.controle.nom })}</p>
                {/if}
              {/if}
            </div>
          {/if}

          {#if liste !== null}
            <div class="produite">
              {#if liste.chemin !== null}
                <p>
                  <span>{t('badges.produite.liste')}</span>
                  <span class="chemin" data-chemin-liste>{liste.chemin}</span>
                </p>
              {:else}
                <p data-chemin-liste>{t('badges.produite.listeTelechargee', { nom: liste.nom })}</p>
              {/if}
            </div>
          {/if}
        </div>
      </Carte>

      <Reedition {charge} executer={produire} {gestes} />
    {/if}
  </section>

  {#if charge !== null}
    <section class="partie" data-partie-impression="plan" aria-labelledby={`${uid}-partie-plan`}>
      <h3 id={`${uid}-partie-plan`}>{t('badges.partie.plan')}</h3>
      <Apercu />
    </section>
  {/if}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
    min-width: 0;
  }

  h2 {
    margin: 0;
    font-size: var(--taille-titre);
  }

  /* Le titre d'une partie, au corps des titres de carte — aucun jeton ne
     tombe entre lui et celui de la section — : sa place, au-dessus des
     cartes de sa partie, et le filet qui ouvre la seconde partie, au-dessus
     de son titre, l'en distinguent. */
  .partie > h3 {
    margin: 0;
    font-size: var(--taille-titre-carte);
  }

  .partie + .partie {
    padding-top: var(--espace-4);
    border-top: 1px solid var(--couleur-page-filet);
  }

  .annonce h5 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  p {
    margin: 0;
  }

  .planche {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  /* Les réglages : chaque libellé, en petites capitales d'encre secondaire,
     au-dessus de son sélecteur. */
  .reglages {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: var(--espace-3) var(--espace-5);
  }

  .reglage {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  .reglage > span {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  /* Les cases de ce que le badge imprime, sous les sélecteurs : leur
     intitulé, en petites capitales d'encre secondaire comme celui d'un
     sélecteur, puis les cinq cases en rangée qui se replie, puis celle du
     nom des doublons et sa note, puis celle du pied TechnoLibre. Chaque
     case : la case, puis son libellé, en encre courante. */
  .cases {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  .intitule {
    color: var(--couleur-page-texte-secondaire);
    font-size: var(--taille-intertitre);
    font-weight: bold;
    letter-spacing: var(--interlettre-capitales);
    text-transform: uppercase;
  }

  .rangee {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-5);
  }

  .case {
    display: flex;
    align-items: center;
    gap: var(--espace-2);
  }

  .case input {
    margin: 0;
  }

  /* Une case désactivée, celle de l'organisation en gros sans organisation
     imprimée : son libellé passe à l'encre secondaire, comme le champ du
     texte du pied TechnoLibre. */
  .case input:disabled + label {
    color: var(--couleur-page-texte-secondaire);
  }

  /* Une case suivie de sa note, en encre secondaire, serrée sous elle et
     alignée sur le retrait du texte du pied TechnoLibre. */
  .case-notee {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .note {
    padding-left: var(--espace-5);
  }

  /* Le texte du pied TechnoLibre, sous sa case, en retrait : son libellé,
     en encre courante, puis le champ de trois lignes, que l'opérateur peut
     agrandir en hauteur, son aide en encre secondaire, et « Texte par
     défaut », une commande secondaire, tiretée quand elle est désactivée. */
  .texte-pied {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
    padding-left: var(--espace-5);
  }

  textarea {
    box-sizing: border-box;
    width: min(100%, 40rem);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    resize: vertical;
  }

  textarea:disabled {
    color: var(--couleur-page-texte-secondaire);
  }

  .aide {
    color: var(--couleur-page-texte-secondaire);
  }

  button.defaut {
    border-style: solid;
    color: var(--couleur-page-texte);
    font-weight: normal;
    cursor: pointer;
  }

  button.defaut:disabled {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: default;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-3);
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-ligne-filet);
  }

  select {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
  }

  /* « Produire » désactivé tant qu'un refus tient : à la hauteur de l'action
     principale, son filet tireté et son texte secondaire le distinguent, et
     son explication suit la rangée des commandes, sans séparer deux
     commandes. */
  button {
    min-height: var(--hauteur-cible);
    padding: 0 var(--espace-4);
    border: 1px dashed var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte-secondaire);
    font: inherit;
    font-size: var(--taille-texte);
    font-weight: bold;
    cursor: not-allowed;
  }

  select:focus-visible,
  textarea:focus-visible,
  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .explication {
    color: var(--couleur-page-texte-secondaire);
  }

  .annonce {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    margin: 0;
    padding-left: var(--espace-4);
  }

  .produite {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-information-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-information-fond);
  }

  /* Un chemin long se coupe où il faut, plutôt que de déborder. */
  .chemin {
    font-weight: bold;
    overflow-wrap: anywhere;
  }
</style>
