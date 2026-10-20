<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le bandeau d'application, présent sur tout écran (§ 8.4, § 18.6) : le
  // nom, la version — ou la marque de provenance d'une construction de
  // documentation —, la provenance, et, quand un événement est ouvert, le
  // libellé de mode, l'annonce de format du fichier et la commande « Liste
  // des événements ». Il porte aussi l'ouverture du panneau « Paramètres »,
  // où se règlent la taille du texte et le thème, et celle du panneau « À
  // propos ». Collé en haut de la fenêtre, il ne défile pas.
  //
  // Son habillage : la marque — le dessin d'une table ronde et de ses six
  // chaises, caché aux technologies d'assistance —, le nom, la version et la
  // provenance en pilules, le libellé de mode en pilule grasse, puis, à
  // droite, « Liste des événements » précédée de son icône, « Paramètres » et
  // « À propos ». Chaque élément garde la hauteur d'une ligne de commande du
  // bandeau : à la taille du texte par défaut, le bandeau tient sur une
  // ligne à 1 366 px, l'événement ouvert, et la surface de travail garde sa
  // hauteur ; aux paliers plus grands, il peut passer sur deux lignes.
  //
  // Le bandeau ne décide de rien : App lui donne l'état de la séance, la
  // version et la provenance telles qu'elles s'affichent et les gestes à
  // appeler ; mode.js choisit les clés du libellé de mode et de
  // l'annonce. Le refus de « Liste des événements » passe par la primitive
  // Refus, qui pose son texte et son remède en Commande — écrire ailleurs
  // sous un support rompu. Ce refus se pose sous les commandes, hors du
  // flux : le bandeau garde sa hauteur, et l'écran de l'événement, sa place
  // fixe comprise, ne bouge pas (§ 8.4). Le refus est un bloc : les
  // commandes qui le portent sont un <div>, non un <span>.
  import { getContext } from 'svelte';
  import { cleAnnonceFormat, cleDeMode } from './mode.js';
  import Icone from './primitives/Icone.svelte';
  import Refus from './primitives/Refus.svelte';

  const t = getContext('t');

  let { etat, version, provenance, refusListe, ouvrirParametres, ouvrirApropos, revenirALaListe } = $props();

  const cleMode = $derived(cleDeMode(etat));
  const cleAnnonce = $derived(cleAnnonceFormat(etat));
</script>

<header class="bandeau" data-bandeau>
  <svg class="marque" width="24" height="24" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
    <circle cx="15" cy="15" r="7" fill="none" stroke="currentColor" stroke-width="2" />
    <circle cx="15" cy="3.5" r="2.5" fill="currentColor" />
    <circle cx="25" cy="9.5" r="2.5" fill="currentColor" />
    <circle cx="25" cy="20.5" r="2.5" fill="currentColor" />
    <circle cx="15" cy="26.5" r="2.5" fill="currentColor" />
    <circle cx="5" cy="20.5" r="2.5" fill="currentColor" />
    <circle cx="5" cy="9.5" r="2.5" fill="currentColor" />
  </svg>
  <span class="nom">{t('coquille.nom')}</span>
  <span class="pilule version">{version}</span>
  <span class="pilule provenance">{provenance}</span>
  {#if cleMode !== null}
    <span class="pilule mode" data-mode-libelle="bandeau">{t(cleMode)}</span>
  {/if}
  {#if cleAnnonce !== null}
    <span class="pilule annonce" data-avertissement="annonceFormat">{t(cleAnnonce)}</span>
  {/if}
  <div class="commandes">
    {#if etat.evenement !== null}
      <button type="button" data-commande="liste" onclick={revenirALaListe}
        ><Icone nom="liste" />{t('coquille.liste')}</button
      >
      {#if refusListe !== null}
        <div class="refus-liste" data-refus="liste">
          <Refus refus={refusListe} />
        </div>
      {/if}
    {/if}
    <button type="button" data-commande="parametres" onclick={ouvrirParametres}>{t('coquille.parametres.titre')}</button>
    <button type="button" data-commande="apropos" onclick={ouvrirApropos}>{t('coquille.apropos.titre')}</button>
  </div>
</header>

<style>
  .bandeau {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2) var(--espace-3);
    padding: var(--espace-2) var(--espace-4);
    border-bottom: 1px solid var(--couleur-bandeau-filet);
    background-color: var(--couleur-bandeau-fond);
    color: var(--couleur-bandeau-texte);
    font-size: var(--taille-texte-bandeau);
  }

  .marque {
    flex: none;
    color: var(--couleur-bandeau-marque);
  }

  .nom {
    font-weight: bold;
  }

  /* La version, la provenance, le libellé de mode et l'annonce : des
     pilules à filet. */
  .pilule {
    padding: 0.125rem var(--espace-2);
    border: 1px solid var(--couleur-bandeau-filet);
    border-radius: var(--rayon-pilule);
    font-size: var(--taille-texte-petit);
  }

  .version,
  .provenance {
    color: var(--couleur-bandeau-texte-secondaire);
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
    border-radius: var(--rayon-2);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    box-shadow: var(--ombre-2);
  }

  .commandes {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
    margin-left: auto;
  }

  button {
    display: inline-flex;
    align-items: center;
    gap: var(--espace-1);
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-bandeau-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-bandeau-fond);
    color: var(--couleur-bandeau-texte);
    font: inherit;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
