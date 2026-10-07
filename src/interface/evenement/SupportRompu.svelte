<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le support rompu (§ 8.6) : le texte du refus SUPPORT_ROMPU, qui nomme le
  // fichier, le dossier et la cause, et dit que l'historique et l'état ne se
  // correspondent plus sur ce support ; puis les issues. « Écrire dans les
  // Documents » quand la séance propose la racine documents (ailleurs) ;
  // toujours « Choisir un dossier… », seance.ecrireAilleurs(null), qui
  // demande le dossier à l'opérateur — un refus, NON_DISPONIBLE sous web,
  // s'affiche à côté de la commande ; et « Fermer sans écrire ailleurs »,
  // confirmé en place, qui abandonne l'événement à ce support.
  import { getContext } from 'svelte';
  import Commande from '../primitives/Commande.svelte';

  const t = getContext('t');
  const seance = getContext('seance');

  const rompu = $derived($seance.supportRompu);
  const refus = $derived(
    rompu === null
      ? null
      : { echec: rompu.echec, chemin: rompu.chemin, dossier: rompu.dossier, cause: rompu.cause },
  );
</script>

{#if rompu !== null}
  <section class="rompu" role="status" data-support-rompu>
    <p>{t('SUPPORT_ROMPU', refus)}</p>
    <div class="issues">
      {#if rompu.ailleurs !== null}
        <Commande
          cle="communs.commande.ecrireDocuments"
          nom="ecrireDocuments"
          executer={() => seance.ecrireAilleurs(rompu.ailleurs)}
        />
      {/if}
      <Commande cle="communs.commande.choisirDossier" nom="choisirDossier" executer={() => seance.ecrireAilleurs(null)} />
      <Commande
        cle="evenement.supportRompu.abandonner"
        nom="abandonner"
        confirmer="evenement.supportRompu.confirmerAbandon"
        executer={() => seance.fermer({ abandonner: true })}
      />
    </div>
  </section>
{/if}

<style>
  .rompu {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    padding: var(--espace-2) var(--espace-3);
    border-left: 3px solid var(--couleur-refus);
    color: var(--couleur-refus);
    font-size: var(--taille-texte);
  }

  p {
    margin: 0;
  }

  .issues {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }
</style>
