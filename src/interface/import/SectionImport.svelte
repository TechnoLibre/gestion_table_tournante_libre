<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La section de l'import des participants (§ 10.1, § 10.2, § 2.1 étape
  // 2). Un fichier choisi par le dialogue de la façade, un fichier déposé
  // sur la fenêtre, ou un texte que le collage de la grille remet par
  // ui.ouvrirImport, ouvre l'aperçu ; rien ne s'importe hors de lui.
  // L'aperçu se calcule par apercevoir contre les participants de la
  // charge, sous le mode choisi et le choix des colonnes ambiguës : il
  // n'écrit rien, et s'ouvre en lecture comme sur un plan bloqué. Seule
  // « Importer » écrit, par seance.executer('importerParticipants', …), et
  // son refus se pose à côté d'elle ; « Remplacer » passe d'abord par la
  // fenêtre à confirmer, qui porte les quatre comptes de bilanRemplacement,
  // et ne l'ouvre que sur un import que la commande accepterait.
  // Le rapport lit le résumé que la séance rend.
  //
  // Le CSV des refus — de l'aperçu, ou du résumé dans le rapport — vient
  // d'exporterRefus de src/application/csv.js, dont le motif est celui de
  // libelle ; la façade l'enregistre sous ‹base›-refus.csv. La détection
  // d'encodage ou de séparateur ne se force pas : l'opérateur ferme l'aperçu
  // et corrige le fichier.
  import { getContext, untrack } from 'svelte';
  import { appliquerCommande } from '../../application/commandes.js';
  import { apercevoir, bilanRemplacement, decoder, exporterRefus } from '../../application/csv.js';
  import Commande from '../primitives/Commande.svelte';
  import Confirmation from '../primitives/Confirmation.svelte';
  import Apercu from './Apercu.svelte';
  import Rapport from './Rapport.svelte';
  import { MODES_D_IMPORT, avecEntetesDeLaGrille, modeleApercu, modePropose } from './modele.js';

  const t = getContext('t');
  const seance = getContext('seance');
  const facade = getContext('facade');
  const ui = getContext('ui');
  const uid = $props.id();

  // La source de l'aperçu : { origine: 'fichier'|'collage', nom, encodage,
  // texte, refusDecodage } ; texte null sous un refus de decoder.
  let source = $state.raw(null);
  // { champ: rang } qui tranche une ambiguïté de l'en-tête.
  let choix = $state.raw({});
  let mode = $state('ajouter');
  // Le dernier import appliqué : { modele, source, apercu, resume, libelle }.
  let rapport = $state.raw(null);
  // La fenêtre de « Remplacer » ouverte : { apercu, elements }.
  let confirmation = $state.raw(null);
  // Le chemin où le CSV des refus vient d'être enregistré.
  let enregistre = $state(null);

  const participants = $derived($seance.charge?.participants ?? []);
  const apercu = $derived(
    source === null || source.refusDecodage !== null ? null : apercevoir(source.texte, { participants, choix, mode }),
  );
  const modele = $derived(
    source === null ? null : modeleApercu({ encodage: source.encodage, apercu, refusDecodage: source.refusDecodage }),
  );
  // Le texte relu dans l'ordre de la grille, offert à un collage seul.
  const grille = $derived(source?.origine === 'collage' && apercu !== null ? avecEntetesDeLaGrille(source.texte, apercu) : null);

  // Une source neuve : le choix des colonnes repart de rien, le mode
  // proposé suit la liste, le rapport précédent se retire.
  function ouvrirSource(nouvelle) {
    source = nouvelle;
    choix = {};
    mode = modePropose(untrack(() => participants));
    rapport = null;
    confirmation = null;
    enregistre = null;
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
      if (pris !== null) ouvrirSource({ origine: 'collage', nom: null, encodage: null, texte: pris.texte, refusDecodage: null });
    });
  });

  function choisirColonne(champ, rang) {
    choix = { ...choix, [champ]: rang };
  }

  function lireDansLOrdreDeLaGrille() {
    source = { ...source, texte: grille };
    choix = {};
  }

  function fermerApercu() {
    source = null;
    enregistre = null;
  }

  // L'aperçu appliqué par la séance, dans son mode ; le rapport lit le
  // résumé rendu, et l'aperçu se ferme.
  async function appliquer(applique, sonMode, depuis) {
    const { libelle, resume } = await seance.executer('importerParticipants', { apercu: applique, mode: sonMode });
    rapport = {
      modele: modeleApercu({ encodage: depuis.encodage, apercu: applique }),
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
  // destruction qui n'aura pas lieu.
  async function importer() {
    const applique = apercu;
    const sonMode = mode;
    const depuis = source;
    if (sonMode !== 'remplacer') {
      await appliquer(applique, sonMode, depuis);
      return;
    }
    const { refus, charge } = seance.etat();
    if (refus !== null) throw refus;
    appliquerCommande('importerParticipants', charge, { apercu: applique, mode: sonMode });
    const bilan = bilanRemplacement(charge);
    confirmation = {
      apercu: applique,
      depuis,
      elements: [
        t('import.remplacer.participants', { n: bilan.participants }),
        t('import.remplacer.reservations', { n: bilan.reservations }),
        t('import.remplacer.titres', { n: bilan.titresPourvus }),
        t('import.remplacer.propositions', { n: bilan.propositions }),
      ],
    };
  }

  async function confirmerRemplacement() {
    await appliquer(confirmation.apercu, 'remplacer', confirmation.depuis);
    confirmation = null;
  }

  // Le CSV des refus, remis à la façade sous ‹base›-refus.csv.
  async function enregistrerRefus(octets) {
    enregistre = await facade.enregistrerSous(`${seance.etat().evenement.base}-refus.csv`, octets);
  }
</script>

<svelte:window ondragover={survoler} ondrop={deposer} />

<section class="import" data-section="import">
  <h2>{t('coquille.section.import')}</h2>
  <p>{t('import.consigne')}</p>
  <div class="commandes">
    <Commande cle="import.commande.choisirFichier" nom="choisirFichier" executer={choisirFichier} />
  </div>

  {#if source !== null}
    {#key source}
      <section class="apercu" data-apercu>
        <h3>{t('import.apercu.titre')}</h3>
        {#if modele.global === null}
          <fieldset class="modes" data-champ="mode">
            <legend>{t('import.mode.titre')}</legend>
            {#each MODES_D_IMPORT as { mode: valeur, cle } (valeur)}
              <label>
                <input type="radio" name={`${uid}-mode`} value={valeur} bind:group={mode} />
                <span>{t(cle)}</span>
              </label>
            {/each}
          </fieldset>
        {/if}
        <Apercu {modele} source={{ origine: source.origine, nom: source.nom }} {participants} choisir={choisirColonne} />
        <div class="commandes">
          {#if grille !== null}
            <Commande cle="import.commande.ordreDeLaGrille" nom="ordreDeLaGrille" executer={lireDansLOrdreDeLaGrille} />
          {/if}
          {#if modele.global === null}
            <Commande cle="import.commande.importer" nom="importer" executer={importer} />
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
      </section>
    {/key}
  {/if}

  {#if rapport !== null}
    <Rapport {rapport} {participants} />
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
  {/if}

  {#if confirmation !== null}
    <Confirmation
      titre="import.remplacer.titre"
      elements={confirmation.elements}
      surConfirmer={confirmerRemplacement}
      surAnnuler={() => (confirmation = null)}
    />
  {/if}
</section>

<style>
  .import {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  .apercu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-page-filet);
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
  }
</style>
