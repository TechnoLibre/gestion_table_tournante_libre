<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le bandeau d'application, présent sur tout écran (§ 8.4, § 18.6) : le
  // nom, la version — ou la marque de provenance d'une construction de
  // documentation —, la provenance, et, quand un événement est ouvert, le
  // libellé de mode, l'annonce de format du fichier et la commande « Liste
  // des événements ». Il porte aussi le réglage de thème, deux commandes à
  // aria-pressed, et l'ouverture du panneau « À propos ». Collé en haut de la
  // fenêtre, il ne défile pas.
  //
  // Le bandeau ne décide de rien : App lui donne l'état de la séance, la
  // version et la provenance telles qu'elles s'affichent, le thème et les
  // gestes à appeler ; mode.js choisit les clés du libellé de mode et de
  // l'annonce. Le refus de « Liste des événements » passe par la primitive
  // Refus, qui pose son texte et son remède en Commande — écrire ailleurs
  // sous un support rompu. Ce refus se pose sous les commandes, hors du
  // flux : le bandeau garde sa hauteur, et l'écran de l'événement, sa place
  // fixe comprise, ne bouge pas (§ 8.4).
  import { getContext } from 'svelte';
  import { cleAnnonceFormat, cleDeMode } from './mode.js';
  import Refus from './primitives/Refus.svelte';
  import { THEMES, cleDeTheme } from './theme.js';

  const t = getContext('t');

  let { etat, version, provenance, theme, refusListe, choisirTheme, ouvrirApropos, revenirALaListe } = $props();

  const cleMode = $derived(cleDeMode(etat));
  const cleAnnonce = $derived(cleAnnonceFormat(etat));
</script>

<header class="bandeau" data-bandeau>
  <span class="nom">{t('coquille.nom')}</span>
  <span class="version">{version}</span>
  <span class="provenance">{provenance}</span>
  {#if cleMode !== null}
    <span class="mode" data-mode-libelle="bandeau">{t(cleMode)}</span>
  {/if}
  {#if cleAnnonce !== null}
    <span class="annonce" data-avertissement="annonceFormat">{t(cleAnnonce)}</span>
  {/if}
  <span class="commandes">
    {#if etat.evenement !== null}
      <button type="button" data-commande="liste" onclick={revenirALaListe}>{t('coquille.liste')}</button>
      {#if refusListe !== null}
        <div class="refus-liste" data-refus="liste">
          <Refus refus={refusListe} />
        </div>
      {/if}
    {/if}
    <span class="themes" role="group" aria-label={t('coquille.theme.titre')}>
      {#each THEMES as choix (choix)}
        <button
          type="button"
          data-commande="theme"
          data-theme-choix={choix}
          aria-pressed={theme === choix}
          onclick={() => choisirTheme(choix)}>{t(cleDeTheme(choix))}</button
        >
      {/each}
    </span>
    <button type="button" data-commande="apropos" onclick={ouvrirApropos}>{t('coquille.apropos.titre')}</button>
  </span>
</header>

<style>
  .bandeau {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2) var(--espace-3);
    padding: var(--espace-2) var(--espace-4);
    border-bottom: 1px solid var(--couleur-bandeau-filet);
    background-color: var(--couleur-bandeau-fond);
    color: var(--couleur-bandeau-texte);
    font-size: var(--taille-texte-bandeau);
  }

  .provenance,
  .mode,
  .annonce {
    padding: 0 var(--espace-2);
    border: 1px solid var(--couleur-bandeau-filet);
    border-radius: var(--rayon-1);
  }

  .mode {
    font-weight: bold;
  }

  /* Le refus garde les couleurs de la page, sur lesquelles sa couleur et
     celles de sa commande tiennent leur contraste : le fond du bandeau ne
     passe pas sous lui. Posé sous les commandes, aligné à leur droite, il
     recouvre l'écran au lieu de le pousser. Sa largeur bornée le tient à
     droite, loin de la place fixe, qui ouvre l'écran à gauche, et dans la
     fenêtre. */
  .refus-liste {
    position: absolute;
    top: 100%;
    right: 0;
    width: max-content;
    max-width: min(32rem, calc(100vw - 2 * var(--espace-4)));
    margin-top: var(--espace-1);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
  }

  .commandes,
  .themes {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--espace-2);
  }

  .commandes {
    position: relative;
    margin-left: auto;
  }

  button {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-bandeau-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-bandeau-fond);
    color: var(--couleur-bandeau-texte);
    font: inherit;
    cursor: pointer;
  }

  /* Le thème retenu se distingue par sa forme autant que par ses couleurs :
     texte souligné et gras, couleurs du bandeau inversées. */
  button[aria-pressed='true'] {
    background-color: var(--couleur-bandeau-texte);
    color: var(--couleur-bandeau-fond);
    font-weight: bold;
    text-decoration: underline;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
