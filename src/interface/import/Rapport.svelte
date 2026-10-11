<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le rapport d'un import appliqué (§ 10.1, § 10.4) : les comptes du résumé
  // que rend seance.executer, ceux de sa nature (comptesDuRapport) — pour des
  // participants, ajoutés, mis à jour, inchangés, retirés, réservations
  // retirées ; pour des objectifs, ajoutés, remplacés, inchangés, retirés,
  // tables dont les objectifs changent —, puis l'aperçu appliqué, ses lignes
  // refusées remplacées par resume.refusees : celles de l'aperçu, puis celles
  // de la mise à jour, chacune à son rang, avec les personnes qu'elle
  // désigne. Un import qui n'a rien écrit le dit.
  //
  // Le rapport est une carte titrée ; ses comptes, des chiffres tabulaires
  // en tête de chaque libellé ; un import qui n'a rien écrit le dit en
  // information (Message). Ses commandes, celles de la section, viennent
  // en pied de carte (commandes, un snippet).
  //
  // rapport : { nature, modele, source, resume, libelle } ; participants :
  // ceux de la charge écrite.
  import { getContext } from 'svelte';
  import Carte from '../primitives/Carte.svelte';
  import Apercu from './Apercu.svelte';
  import Message from './Message.svelte';
  import { comptesDuRapport, refuseesDe } from './modele.js';

  let { rapport, participants, commandes = null } = $props();

  const t = getContext('t');
  const format = getContext('format');

  // Ce qu'un import qui n'a rien écrit dit, par nature.
  const RIEN_ECRIT = new Map([
    ['participants', 'import.rapport.rienEcrit'],
    ['objectifs', 'import.rapport.rienEcritObjectifs'],
  ]);

  const comptes = $derived(comptesDuRapport(rapport.nature));
  const refusees = $derived(refuseesDe(rapport.resume.refusees));
</script>

<div class="rapport" data-rapport>
  <Carte titre={t('import.rapport.titre')} niveau={3}>
    <div class="contenu">
      {#if rapport.libelle === null}
        <Message bloc="rienEcrit"><p>{t(RIEN_ECRIT.get(rapport.nature))}</p></Message>
      {/if}
      <ul class="comptes">
        {#each comptes as { nom, cle } (nom)}
          <li data-compte={nom}>
            <span class="nombre" data-nombre>{format.nombre(rapport.resume[nom])}</span>
            <span>{t(cle, { n: rapport.resume[nom] })}</span>
          </li>
        {/each}
      </ul>
      <Apercu modele={rapport.modele} source={rapport.source} {participants} {refusees} />
      {#if commandes !== null}
        <div class="pied">{@render commandes()}</div>
      {/if}
    </div>
  </Carte>
</div>

<style>
  .contenu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  p {
    margin: 0;
  }

  /* Les comptes : une rangée de cases, le nombre en gras et en chiffres
     tabulaires, son libellé à côté. */
  .comptes {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .comptes li {
    display: flex;
    align-items: baseline;
    gap: var(--espace-1);
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
  }

  .nombre {
    font-size: var(--taille-titre-carte);
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }

  .pied {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
    padding-top: var(--espace-3);
    border-top: 1px solid var(--couleur-carte-filet);
  }
</style>
