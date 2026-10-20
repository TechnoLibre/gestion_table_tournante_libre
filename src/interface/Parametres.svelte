<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le panneau « Paramètres » (§ 18.6) : la taille du texte de l'écran et le
  // thème, deux réglages de la machine et de la séance, jamais de
  // l'événement. App le monte à la place de l'écran tant que l'état de
  // navigation le dit ouvert ; « À propos » et lui ne sont jamais ouverts
  // ensemble.
  //
  // La taille du texte : un choix par palier de src/geometrie/taille_texte.js,
  // le courant enfoncé, lu dans EtatSeance.tailleTexte. Un choix passe par
  // seance.choisirTailleTexte, vivant dans tout mode, qui l'écrit dans
  // reglages_locaux.json (§ 8.5) ; une taille que la séance ne retient pas
  // vaut pour la séance, et une annonce le dit sous les choix jusqu'au choix
  // suivant. App pose la taille sur la racine du document.
  //
  // Le thème : un choix par thème, le courant enfoncé, lu dans l'état de
  // navigation, que choisirTheme change pour la séance (§ 19.2).
  //
  // Habillage : le titre de l'écran, une carte par réglage, titrée et
  // expliquée en sous-titre, ses choix en commandes enfoncées qui se
  // touchent — l'enfoncé sur la teinte de l'action, en gras —, puis
  // « Fermer ».
  import { getContext } from 'svelte';
  import { PALIERS_TAILLE_TEXTE } from '../geometrie/taille_texte.js';
  import Message from './accueil/Message.svelte';
  import Carte from './primitives/Carte.svelte';
  import Commande from './primitives/Commande.svelte';
  import { THEMES, cleDeTheme } from './theme.js';

  let { fermer } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const ui = getContext('ui');

  // La dernière taille choisie que le poste n'a pas retenue, ou null.
  // L'avis ne vaut que tant que cette taille est celle de l'écran : une
  // relecture des réglages d'un autre dossier qui la remplace le retire.
  let nonRetenue = $state(null);

  async function choisirTaille(taille) {
    const { retenue } = await seance.choisirTailleTexte(taille);
    nonRetenue = retenue ? null : taille;
  }
</script>

<section class="parametres" data-ecran="parametres">
  <h1>{t('coquille.parametres.titre')}</h1>
  <Carte titre={t('coquille.parametres.taille.titre')} sousTitre={t('coquille.parametres.taille.explication')}>
    <div class="reglage">
      <div class="choix" role="group" aria-label={t('coquille.parametres.taille.titre')}>
        {#each PALIERS_TAILLE_TEXTE as taille (taille)}
          <button
            type="button"
            data-commande="tailleTexte"
            data-cible={taille}
            aria-pressed={$seance.tailleTexte === taille}
            onclick={() => choisirTaille(taille)}>{t('coquille.parametres.taille.palier', { taille })}</button
          >
        {/each}
      </div>
      <div role="status">
        {#if nonRetenue !== null && nonRetenue === $seance.tailleTexte}
          <Message ton="avis"><p data-avertissement="tailleNonRetenue">{t('coquille.parametres.taille.nonRetenue')}</p></Message>
        {/if}
      </div>
    </div>
  </Carte>
  <Carte titre={t('coquille.theme.titre')} sousTitre={t('coquille.parametres.theme.explication')}>
    <div class="choix" role="group" aria-label={t('coquille.theme.titre')}>
      {#each THEMES as choix (choix)}
        <button
          type="button"
          data-commande="theme"
          data-theme-choix={choix}
          aria-pressed={$ui.theme === choix}
          onclick={() => ui.choisirTheme(choix)}>{t(cleDeTheme(choix))}</button
        >
      {/each}
    </div>
  </Carte>
  <div class="commandes">
    <Commande cle="coquille.parametres.fermer" nom="fermerParametres" executer={fermer} />
  </div>
</section>

<style>
  .parametres {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  h1 {
    margin: 0;
  }

  p {
    margin: 0;
  }

  .reglage {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-3);
  }

  /* Les choix d'un réglage se touchent : leurs filets se recouvrent, et
     seuls les bords extérieurs du groupe sont arrondis. */
  .choix {
    display: inline-flex;
    flex-wrap: wrap;
  }

  .choix button + button {
    margin-left: -1px;
  }

  .choix button:not(:first-child) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }

  .choix button:not(:last-child) {
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
  }

  button {
    min-height: var(--cible-minimale);
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* Le choix enfoncé : la teinte de l'action, le texte en gras de l'encre de
     la page ; le gras le distingue sans la couleur. */
  button[aria-pressed='true'] {
    position: relative;
    background-color: var(--couleur-action-teinte);
    font-weight: bold;
  }

  button:focus-visible {
    position: relative;
    z-index: 1;
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }
</style>
