<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // La vue « Profil trié des rencontres » (§ 12.3, B12, B15, D28, D30, D41,
  // D51) de la page de qualité : deux graphiques empilés au même ordre de
  // rangs, puis leur jumeau. Le premier, en comptes de personnes : les
  // rencontres en plein, les appartenances rencontrées en tirets, le plafond
  // réalisé en trait mixte, la borne de diversité en pointillés, les rangs
  // marqués de leur signe, et sa phrase de synthèse dessous. Le second, en
  // pourcentages : le pourcentage de chaque rang, interrompu aux rangs sans
  // plafond, la règle à 100 %, les mêmes signes aux mêmes rangs — celui
  // d'un rang sans point au pied de l'axe —, et sa synthèse, la personne au
  // rang 1, son pourcentage et le compte du pire. Une appartenance au plus :
  // une seule série, sans borne, et la phrase du cas ; une seule table : la
  // phrase seule.
  //
  // Elle reçoit le contrat de propriétés des vues — detail, le détail du
  // placement mesuré, null tant qu'il n'est pas calculé ; ligne et table,
  // qu'elle ne lit pas — et rend ce que profilDe (profil.js) en tire : rien
  // ne se trie ni ne se calcule ici. Les deux graphiques partagent le rang
  // pointé (pointe) — l'infobulle porte la ligne entière du rang, dans le
  // seul graphique survolé — et leurs marges (margesCommunes), qui alignent
  // leurs abscisses rang contre rang.
  //
  // Désignations : data-vue-qualite sur le <div> qui enveloppe la carte ;
  // data-graphique profilComptes et profilPourcentages sur les deux <svg> ;
  // data-phrase-qualite sur la phrase d'un cas limite, par son code.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Escalier from './graphiques/Escalier.svelte';
  import Jumeau from './graphiques/Jumeau.svelte';
  import Pourcentage from './graphiques/Pourcentage.svelte';
  import { margesCommunes } from './graphiques/pointage.js';
  import { graduerPourcent, profilDe } from './profil.js';

  let { detail = null, ligne = null, table = null } = $props();

  const t = getContext('t');
  const format = getContext('format');

  const profil = $derived(profilDe(detail, { t, format }));
  const graduer = graduerPourcent({ t, format });
  const titreX = t('qualite.profil.axe.rangs');

  let pointe = $state(null);
  let margesComptes = $state(null);
  let margesPourcentages = $state(null);
  const communes = $derived(margesCommunes([margesComptes, margesPourcentages]));
</script>

{#snippet synthesePourcentages()}
  <span class="synthese">{profil.pourcentages.synthese.texte}</span>
  {#if profil.pourcentages.synthese.pourcentage !== null}
    <Pourcentage texte={profil.pourcentages.synthese.pourcentage.texte} compte={profil.pourcentages.synthese.pourcentage.compte} />
  {/if}
{/snippet}

<div data-vue-qualite="profil">
  <Carte titre={t('qualite.vue.profil.titre')} sousTitre={t('qualite.vue.profil.question')} niveau={3}>
    {#if profil !== null}
      <div class="profil">
        {#if profil.phrase !== null}
          <p data-phrase-qualite={profil.phrase}>{t(`qualite.profil.${profil.phrase}`)}</p>
        {/if}
        {#if profil.cas === 'profil'}
          <Escalier
            graphique="profilComptes"
            nom={profil.comptes.nom}
            synthese={profil.comptes.synthese}
            series={profil.comptes.series}
            reperes={profil.comptes.reperes}
            marques={profil.comptes.marques}
            infobulle={profil.infobulle}
            {titreX}
            alignerSur={communes}
            bind:marges={margesComptes}
            bind:pointe
          />
          <Escalier
            graphique="profilPourcentages"
            nom={profil.pourcentages.nom}
            synthese={synthesePourcentages}
            series={profil.pourcentages.series}
            reperes={profil.pourcentages.reperes}
            marques={profil.pourcentages.marques}
            infobulle={profil.infobulle}
            {graduer}
            {titreX}
            alignerSur={communes}
            bind:marges={margesPourcentages}
            bind:pointe
          />
          <Jumeau tableaux={profil.tableaux} />
        {/if}
      </div>
    {/if}
  </Carte>
</div>

<style>
  .profil {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
    min-width: 0;
  }

  p {
    margin: 0;
  }

  .synthese {
    display: block;
  }
</style>
