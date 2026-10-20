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
  // confirmé en place, qui abandonne l'événement à ce support. Écrire
  // ailleurs recopie l'événement : il passe par l'indicateur d'activité
  // (activite.js).
  //
  // C'est un message de refus, comme la primitive Refus : le fond et le
  // filet du refus, son trait à gauche, l'icône « interdit » de sa marque
  // devant le texte, l'encre du refus ; les issues sous le texte.
  import { getContext } from 'svelte';
  import { suivre } from '../activite.js';
  import Commande from '../primitives/Commande.svelte';
  import Icone from '../primitives/Icone.svelte';

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
    <span class="signe"><Icone nom="interdit" taille={18} /></span>
    <div class="corps">
      <p>{t('SUPPORT_ROMPU', refus)}</p>
      <div class="issues">
        {#if rompu.ailleurs !== null}
          <Commande
            cle="communs.commande.ecrireDocuments"
            nom="ecrireDocuments"
            executer={() => suivre(() => seance.ecrireAilleurs(rompu.ailleurs))}
          />
        {/if}
        <Commande
          cle="communs.commande.choisirDossier"
          nom="choisirDossier"
          executer={() => suivre(() => seance.ecrireAilleurs(null))}
        />
        <Commande
          cle="evenement.supportRompu.abandonner"
          nom="abandonner"
          confirmer="evenement.supportRompu.confirmerAbandon"
          executer={() => seance.fermer({ abandonner: true })}
        />
      </div>
    </div>
  </section>
{/if}

<style>
  .rompu {
    display: flex;
    align-items: flex-start;
    gap: var(--espace-2) var(--espace-3);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-refus-filet);
    border-left: 3px solid var(--couleur-refus);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-refus-fond);
    color: var(--couleur-refus);
    font-size: var(--taille-texte);
  }

  .signe {
    display: flex;
    flex: none;
    padding-top: 0.125rem;
    color: var(--couleur-refus-marque);
  }

  .corps {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    min-width: 0;
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
