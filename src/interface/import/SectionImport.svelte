<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1 -->

<script>
  // La section d'un import, § 10.1, § 10.2, § 10.4 et § 2.1 étape 2 : des
  // participants, ou des objectifs de table, selon la nature que
  // l'opérateur coche avant l'aperçu — Participants par défaut. La nature
  // ne se devine jamais de l'en-tête : un fichier lu sous la mauvaise se
  // refuse, et l'opérateur la change. Un fichier choisi par le dialogue de
  // la façade, un fichier déposé sur la fenêtre, ou un texte que le collage
  // de la grille remet par ui.ouvrirImport, ouvre l'aperçu ; rien ne
  // s'importe hors de lui. Le collage vient de la grille des participants,
  // et coche leur nature.
  //
  // L'aperçu se calcule par apercevoirSelon (modele.js) contre la charge,
  // sous la nature, le mode choisi et le choix des colonnes ambiguës : il
  // n'écrit rien, et s'ouvre en lecture comme sur un plan bloqué. Changer
  // de nature recalcule l'aperçu du même texte, le choix des colonnes et le
  // mode repartant de rien. « Rendre les noms uniques », offert dans le bloc
  // des doublons quand nomsRendusUniques en rend un au moins, recalcule
  // l'aperçu sur les noms rendus, sous chaque choix et chaque mode qui
  // suivent, jusqu'au prochain texte ou à la prochaine nature : le fichier
  // n'est pas réécrit, et l'import applique l'aperçu montré, ses noms
  // compris. Seule « Importer » écrit, par seance.executer —
  // importerParticipants ou importerObjectifs —, et son refus se pose à
  // côté d'elle ; « Remplacer » passe d'abord par la fenêtre à confirmer,
  // qui porte les quatre comptes de bilanRemplacement pour des
  // participants, les deux de bilanRemplacementObjectifs — objectifs et
  // tables — pour des objectifs, et ne l'ouvre que sur un import que la
  // commande accepterait. Le rapport lit le résumé que la séance rend.
  // L'import appliqué, et l'essai de « Remplacer » avant sa fenêtre, passent
  // par l'indicateur d'activité (activite.js).
  //
  // La section est une carte titrée, dont l'en-tête porte la consigne et
  // « Choisir un fichier CSV… », son action principale, et dont le contenu
  // est le choix de la nature ; l'aperçu, puis le rapport, sont des cartes
  // sous elle.
  //
  // Le CSV des refus — de l'aperçu, ou du résumé dans le rapport — vient
  // d'exporterRefus de src/application/csv.js, dont le motif est celui de
  // libelle ; la façade l'enregistre sous ‹base›-refus.csv. La détection
  // d'encodage ou de séparateur ne se force pas : l'opérateur ferme l'aperçu
  // et corrige le fichier.
  //
  // « Télécharger un modèle », sous le choix de la nature, remet à
  // facade.enregistrerSous le modèle de la nature cochée
  // (modeleATelecharger) : elle n'écrit rien dans l'événement, et part en
  // lecture comme sur un plan bloqué. Son nom accessible nomme la nature ;
  // le chemin enregistré s'annonce sous elle, sous la seule nature de son
  // modèle ; un enregistrement annulé n'annonce rien. Le modèle des
  // objectifs se refuse à côté d'elle sans table, ou quand chaque numéro de
  // table est partagé, avec le remède qui ouvre la section des tables ; la
  // commande se recrée à chaque nature, son refus avec elle.
  import { getContext, untrack } from 'svelte';
  import { appliquerCommande } from '../../application/commandes.js';
  import { bilanRemplacement, bilanRemplacementObjectifs, decoder, exporterRefus } from '../../application/csv.js';
  import { suivre } from '../activite.js';
  import Carte from '../primitives/Carte.svelte';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Apercu from './Apercu.svelte';
  import Rapport from './Rapport.svelte';
  import {
    NATURES_D_IMPORT,
    NATURE_PAR_DEFAUT,
    apercevoirSelon,
    avecEntetesDeLaGrille,
    modeleApercu,
    modeleATelecharger,
    modePropose,
    modesDImport,
    nomsRendusUniques,
  } from './modele.js';

  // La commande qu'applique « Importer », par nature.
  const COMMANDES_DES_NATURES = new Map([
    ['participants', 'importerParticipants'],
    ['objectifs', 'importerObjectifs'],
  ]);

  const t = getContext('t');
  const seance = getContext('seance');
  const facade = getContext('facade');
  const ui = getContext('ui');
  const uid = $props.id();

  // La source de l'aperçu : { origine: 'fichier'|'collage', nom, encodage,
  // texte, refusDecodage } ; texte null sous un refus de decoder.
  let source = $state.raw(null);
  // La nature cochée : ce que le fichier importe.
  let nature = $state(NATURE_PAR_DEFAUT);
  // { champ: rang } qui tranche une ambiguïté de l'en-tête.
  let choix = $state.raw({});
  let mode = $state('ajouter');
  // Vrai quand « Rendre les noms uniques » a été choisi pour ce texte.
  let uniques = $state(false);
  // Le dernier import appliqué : { nature, modele, source, apercu, resume, libelle }.
  let rapport = $state.raw(null);
  // La fenêtre de « Remplacer » ouverte : { titre, nature, apercu, depuis, elements }.
  let confirmation = $state.raw(null);
  // Le chemin où le CSV des refus vient d'être enregistré.
  let enregistre = $state(null);
  // Le dernier modèle enregistré : { nature, chemin } ; il ne s'annonce que
  // sous sa nature.
  let modeleEnregistre = $state.raw(null);

  const charge = $derived($seance.charge ?? null);
  // Le nom accessible de « Télécharger un modèle » sous la nature cochée.
  const nomDuModele = $derived(t(NATURES_D_IMPORT.find((offerte) => offerte.nature === nature).modele));
  const cheminDuModele = $derived(modeleEnregistre?.nature === nature ? modeleEnregistre.chemin : null);
  const participants = $derived(charge?.participants ?? []);
  // L'aperçu du texte tel qu'il est écrit, puis les noms qui en rendraient
  // les doublons uniques.
  const apercuDuTexte = $derived(
    source === null || source.refusDecodage !== null || charge === null
      ? null
      : apercevoirSelon(nature, source.texte, charge, { choix, mode }),
  );
  const noms = $derived(nomsRendusUniques(nature, apercuDuTexte, participants));
  // L'aperçu montré et importé : celui des noms rendus quand ils sont
  // choisis et qu'il y en a.
  const apercu = $derived(
    uniques && noms.size > 0 ? apercevoirSelon(nature, source.texte, charge, { choix, mode, noms }) : apercuDuTexte,
  );
  const rendreUniques = $derived(uniques || noms.size === 0 ? null : () => (uniques = true));
  const modele = $derived(
    source === null ? null : modeleApercu({ nature, encodage: source.encodage, apercu, refusDecodage: source.refusDecodage }),
  );
  // Le texte relu dans l'ordre de la grille, offert à un collage seul.
  const grille = $derived(
    source?.origine === 'collage' && apercu !== null ? avecEntetesDeLaGrille(source.texte, apercu, nature) : null,
  );

  // Ce qui suit un aperçu neuf : le choix des colonnes et les noms rendus
  // uniques repartent de rien, le mode proposé suit la nature et la liste,
  // le rapport précédent se retire.
  function repartir() {
    choix = {};
    uniques = false;
    mode = modePropose(untrack(() => participants), untrack(() => nature));
    rapport = null;
    confirmation = null;
    enregistre = null;
  }

  function ouvrirSource(nouvelle) {
    source = nouvelle;
    repartir();
  }

  // Une autre nature : l'aperçu ouvert se recalcule sur le même texte.
  function choisirNature(nouvelle) {
    nature = nouvelle;
    repartir();
  }

  // Le modèle de la nature cochée, remis à la façade sous son nom.
  async function telechargerModele() {
    const { evenement, charge: courante } = seance.etat();
    const saNature = nature;
    const { nom, octets } = modeleATelecharger(saNature, { base: evenement.base, charge: courante });
    const chemin = await facade.enregistrerSous(nom, octets);
    modeleEnregistre = chemin === null ? null : { nature: saNature, chemin };
  }

  // Les octets d'un fichier : leur texte décodé, ou le refus de decoder,
  // qui tient lieu d'aperçu. Toute autre erreur est une faute, qui remonte.
  function lireFichier({ nom, octets }) {
    try {
      const { texte, encodage } = decoder(octets);
      ouvrirSource({ origine: 'fichier', nom, encodage, texte, refusDecodage: null });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      ouvrirSource({ origine: 'fichier', nom, encodage: null, texte: null, refusDecodage: { code: erreur.code, details: erreur.details } });
    }
  }

  async function choisirFichier() {
    const choisi = await facade.choisirCsv();
    if (choisi !== null) lireFichier(choisi);
  }

  // Un fichier déposé sur la fenêtre ouvre son aperçu, comme un fichier
  // choisi ; un glissement sans fichier n'est pas retenu.
  function survoler(evenement) {
    if (evenement.dataTransfer?.types?.includes('Files')) evenement.preventDefault();
  }

  async function deposer(evenement) {
    const fichier = evenement.dataTransfer?.files?.[0];
    if (fichier === undefined) return;
    evenement.preventDefault();
    lireFichier({ nom: fichier.name, octets: new Uint8Array(await fichier.arrayBuffer()) });
  }

  // Le texte que le collage de la grille remet : pris une fois, il ouvre
  // l'aperçu d'un collage, sans encodage.
  $effect(() => {
    if ($ui.importEnAttente === null) return;
    untrack(() => {
      const pris = ui.prendreImport();
      if (pris === null) return;
      nature = 'participants';
      ouvrirSource({ origine: 'collage', nom: null, encodage: null, texte: pris.texte, refusDecodage: null });
    });
  });

  function choisirColonne(champ, rang) {
    choix = { ...choix, [champ]: rang };
  }

  function lireDansLOrdreDeLaGrille() {
    source = { ...source, texte: grille };
    choix = {};
    uniques = false;
  }

  function fermerApercu() {
    source = null;
    enregistre = null;
  }

  // L'aperçu appliqué par la séance, par la commande de sa nature, dans son
  // mode, sous l'indicateur d'activité ; le rapport lit le résumé rendu, et
  // l'aperçu se ferme.
  async function appliquer(applique, sonMode, depuis, saNature) {
    const { libelle, resume } = await suivre(() =>
      seance.executer(COMMANDES_DES_NATURES.get(saNature), { apercu: applique, mode: sonMode }),
    );
    rapport = {
      nature: saNature,
      modele: modeleApercu({ nature: saNature, encodage: depuis.encodage, apercu: applique }),
      source: { origine: depuis.origine, nom: depuis.nom },
      apercu: applique,
      resume,
      libelle,
    };
    source = null;
    enregistre = null;
  }

  // « Importer » : l'aperçu montré, dans le mode choisi. « Remplacer »
  // ouvre d'abord sa fenêtre, sauf quand le geste serait refusé : le refus
  // de la séance, celui de son état, puis celui de la commande essayée sur
  // la charge sans rien écrire (appliquerCommande, le calcul même que
  // seance.executer applique) — une ambiguïté non tranchée, AMBIGUITE —
  // se posent à côté de la commande, et la fenêtre n'annonce jamais une
  // destruction qui n'aura pas lieu. L'essai et le bilan de la fenêtre se
  // calculent sous l'indicateur d'activité. Le refus vaut pour l'aperçu qui l'a
  // reçu : un choix de colonne ou de mode, qui en fait un autre, le retire
  // (la commande se recrée sous {#key apercu}).
  async function importer() {
    const applique = apercu;
    const sonMode = mode;
    const depuis = source;
    const saNature = nature;
    if (sonMode !== 'remplacer') {
      await appliquer(applique, sonMode, depuis, saNature);
      return;
    }
    const { refus, charge: courante } = seance.etat();
    if (refus !== null) throw refus;
    const annonce = await suivre(() => {
      appliquerCommande(COMMANDES_DES_NATURES.get(saNature), courante, { apercu: applique, mode: sonMode });
      return annonceDuRemplacement(saNature, courante);
    });
    confirmation = { nature: saNature, apercu: applique, depuis, ...annonce };
  }

  // Le titre de la fenêtre de « Remplacer » et ce qu'elle nomme détruit :
  // les personnes, réservations, titres pourvus et propositions pour des
  // participants ; les objectifs et les tables qui en portent pour des
  // objectifs.
  function annonceDuRemplacement(saNature, courante) {
    if (saNature === 'objectifs') {
      const bilan = bilanRemplacementObjectifs(courante);
      return {
        titre: 'import.remplacer.titreObjectifs',
        elements: [t('import.remplacer.objectifs', { n: bilan.objectifs }), t('import.remplacer.tables', { n: bilan.tables })],
      };
    }
    const bilan = bilanRemplacement(courante);
    return {
      titre: 'import.remplacer.titre',
      elements: [
        t('import.remplacer.participants', { n: bilan.participants }),
        t('import.remplacer.reservations', { n: bilan.reservations }),
        t('import.remplacer.titres', { n: bilan.titresPourvus }),
        t('import.remplacer.propositions', { n: bilan.propositions }),
      ],
    };
  }

  async function confirmerRemplacement() {
    await appliquer(confirmation.apercu, 'remplacer', confirmation.depuis, confirmation.nature);
    confirmation = null;
  }

  // Le CSV des refus, remis à la façade sous ‹base›-refus.csv.
  async function enregistrerRefus(octets) {
    enregistre = await facade.enregistrerSous(`${seance.etat().evenement.base}-refus.csv`, octets);
  }
</script>

<svelte:window ondragover={survoler} ondrop={deposer} />

<div class="import" data-section="import">
  <Carte titre={t('coquille.section.import')} sousTitre={t('import.consigne')}>
    {#snippet actions()}
      <Commande cle="import.commande.choisirFichier" nom="choisirFichier" variante="principale" executer={choisirFichier} />
    {/snippet}
    <fieldset class="natures" data-nature-import>
      <legend>{t('import.nature.titre')}</legend>
      {#each NATURES_D_IMPORT as { nature: valeur, cle } (valeur)}
        <label>
          <input
            type="radio"
            name={`${uid}-nature`}
            value={valeur}
            checked={nature === valeur}
            onchange={() => choisirNature(valeur)}
          />
          <span>{t(cle)}</span>
        </label>
      {/each}
    </fieldset>
    <div class="modele">
      {#key nature}
        <Commande
          cle="import.commande.telechargerModele"
          nom="telechargerModele"
          nomAccessible={nomDuModele}
          executer={telechargerModele}
        />
      {/key}
      {#if cheminDuModele !== null}
        <p role="status" data-modele-enregistre>
          <span>{t('import.modele.enregistre')}</span> <span class="chemin">{cheminDuModele}</span>
        </p>
      {/if}
    </div>
  </Carte>

  {#if source !== null}
    {#key source}
      <div class="apercu" data-apercu>
        <Carte titre={t('import.apercu.titre')} niveau={3}>
          <div class="contenu">
            {#if modele.global === null}
              <fieldset class="modes" data-champ="mode">
                <legend>{t('import.mode.titre')}</legend>
                {#each modesDImport(nature) as { mode: valeur, cle } (valeur)}
                  <label>
                    <input type="radio" name={`${uid}-mode`} value={valeur} bind:group={mode} />
                    <span>{t(cle)}</span>
                  </label>
                {/each}
              </fieldset>
            {/if}
            <Apercu
              {modele}
              source={{ origine: source.origine, nom: source.nom }}
              {participants}
              choisir={choisirColonne}
              {rendreUniques}
            />
            <div class="commandes">
              {#if grille !== null}
                <Commande cle="import.commande.ordreDeLaGrille" nom="ordreDeLaGrille" executer={lireDansLOrdreDeLaGrille} />
              {/if}
              {#if modele.global === null}
                {#key apercu}
                  <Commande cle="import.commande.importer" nom="importer" variante="principale" executer={importer} />
                {/key}
              {/if}
              {#if modele.refusees.length > 0}
                <Commande
                  cle="import.commande.enregistrerRefus"
                  nom="enregistrerRefus"
                  executer={() => enregistrerRefus(exporterRefus(apercu))}
                />
              {/if}
              <Commande cle="import.commande.fermerApercu" nom="fermerApercu" executer={fermerApercu} />
            </div>
            {#if enregistre !== null}
              <p><span>{t('import.refusEnregistres')}</span> <span data-enregistre>{enregistre}</span></p>
            {/if}
          </div>
        </Carte>
      </div>
    {/key}
  {/if}

  {#if rapport !== null}
    <Rapport {rapport} {participants}>
      {#snippet commandes()}
        <div class="commandes">
          {#if rapport.resume.refusees.length > 0}
            <Commande
              cle="import.commande.enregistrerRefus"
              nom="enregistrerRefus"
              executer={() => enregistrerRefus(exporterRefus(rapport.apercu, rapport.resume.refusees))}
            />
          {/if}
          <Commande cle="import.commande.fermerRapport" nom="fermerRapport" executer={() => (rapport = null)} />
        </div>
        {#if enregistre !== null}
          <p><span>{t('import.refusEnregistres')}</span> <span data-enregistre>{enregistre}</span></p>
        {/if}
      {/snippet}
    </Rapport>
  {/if}

  {#if confirmation !== null}
    <Confirmation
      titre={confirmation.titre}
      elements={confirmation.elements}
      surConfirmer={confirmerRemplacement}
      surAnnuler={() => (confirmation = null)}
    />
  {/if}
</div>

<style>
  .import {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  .contenu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  p {
    margin: 0;
  }

  .modele {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    margin-top: var(--espace-3);
  }

  /* Un chemin long se coupe où il faut, plutôt que de déborder. */
  .chemin {
    overflow-wrap: anywhere;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .modes,
  .natures {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-3);
    margin: 0;
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
  }

  legend {
    padding: 0 var(--espace-1);
    font-weight: bold;
  }

  /* Le choix de la nature et celui du mode se font aussi au clavier : le
     bouton radio qui a le focus porte l'anneau de l'application. */
  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
