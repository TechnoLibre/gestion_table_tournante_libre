<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le rapport d'un import appliqué (§ 10.1) : les comptes du résumé que
  // rend seance.executer — ajoutés, mis à jour, inchangés, retirés,
  // réservations retirées —, puis l'aperçu appliqué, ses lignes refusées
  // remplacées par resume.refusees : celles de l'aperçu, puis celles de la
  // mise à jour, chacune à son rang, avec les personnes qu'elle désigne. Un
  // import qui n'a rien écrit le dit.
  //
  // rapport : { modele, source, resume, libelle } ; participants : ceux de
  // la charge écrite. Les commandes du rapport sont celles de la section.
  import { getContext } from 'svelte';
  import Apercu from './Apercu.svelte';
  import { refuseesDe } from './modele.js';

  let { rapport, participants } = $props();

  const t = getContext('t');
  const format = getContext('format');

  // Chaque compte du résumé et la clé de son libellé, dans l'ordre du résumé.
  const COMPTES = [
    ['ajoutes', 'import.rapport.ajoutes'],
    ['misAJour', 'import.rapport.misAJour'],
    ['inchanges', 'import.rapport.inchanges'],
    ['retires', 'import.rapport.retires'],
    ['reservationsRetirees', 'import.rapport.reservationsRetirees'],
  ];

  const refusees = $derived(refuseesDe(rapport.resume.refusees));
</script>

<section class="rapport" data-rapport>
  <h3>{t('import.rapport.titre')}</h3>
  {#if rapport.libelle === null}
    <p>{t('import.rapport.rienEcrit')}</p>
  {/if}
  <ul class="comptes">
    {#each COMPTES as [nom, cle] (nom)}
      <li data-compte={nom}>
        <span data-nombre>{format.nombre(rapport.resume[nom])}</span>
        <span>{t(cle, { n: rapport.resume[nom] })}</span>
      </li>
    {/each}
  </ul>
  <Apercu modele={rapport.modele} source={rapport.source} {participants} {refusees} />
</section>

<style>
  .rapport {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-page-filet);
  }

  h3 {
    margin: 0;
  }

  .comptes {
    margin: 0;
    padding-left: var(--espace-5);
  }

  .comptes li {
    display: flex;
    gap: var(--espace-1);
  }
</style>
