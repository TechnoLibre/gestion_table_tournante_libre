<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Les réglages d'une génération (§ 5.7, § 5.10) : la graine, puis le
  // nombre de propositions, le compte d'arrêt et l'historique, chacun sous
  // son libellé, qui porte son unité ; puis la durée observée du dernier
  // calcul de la séance, et ce qu'elle laisse attendre des réglages courants.
  // Aucun champ ne prend une durée : la recherche s'arrête sur un compte.
  //
  // Les trois réglages de la charge (generation.nombre, generation.arret,
  // generation.historique) sont des Champ : une saisie se lit par la
  // validation du contrôleur de génération, la même que celle de
  // « Générer », et s'écrit à la sortie du champ par modifierReglage — une
  // entrée par changement ; en lecture, la séance refuse la première frappe.
  //
  // La graine n'est pas au fichier : c'est une saisie de la commande, vivante
  // en lecture, que le parent tient (graine, liée) et contrôle au clic de
  // « Générer ». Son refus, refusGraine, se pose contre elle ; une frappe
  // appelle saisirGraine, qui le retire.
  import { getContext } from 'svelte';
  import Champ from '../primitives/Champ.svelte';
  import Refus from '../primitives/Refus.svelte';

  let { charge, mesure, estimation, graine = $bindable(), refusGraine = null, saisirGraine } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const generation = getContext('generation');
  const uid = $props.id();
  const idGraine = `${uid}-graine`;
  const idRefusGraine = `${uid}-graine-refus`;

  // Les réglages de la charge, dans l'ordre de l'écran.
  const REGLAGES = ['nombre', 'arret', 'historique'];

  // La lecture d'une saisie du réglage nom : la validation du contrôleur sur
  // les réglages proposés, ce réglage remplacé par la saisie ; son refus, ou
  // à défaut le premier, sinon la valeur lue.
  const lecteur = (nom) => (texte) => {
    const { reglages, refus } = generation.valider({ ...generation.reglagesProposes(), [nom]: texte });
    const propre = refus.find(({ champ }) => champ === nom) ?? refus[0];
    if (propre !== undefined) return { refus: { code: propre.code, details: propre.details } };
    return { valeur: reglages[nom] };
  };

  const ecrire = (nom) => (valeur) => seance.executer('modifierReglage', { cle: `generation.${nom}`, valeur });
</script>

<div class="reglages" data-reglages>
  <div class="champs">
    <div class="champ">
      <label for={idGraine}>{t('generation.reglage.graine')}</label>
      <input
        id={idGraine}
        type="text"
        data-champ="graine"
        bind:value={graine}
        aria-invalid={refusGraine === null ? undefined : 'true'}
        aria-describedby={refusGraine === null ? undefined : idRefusGraine}
        oninput={() => saisirGraine()}
      />
      {#if refusGraine !== null}
        <Refus id={idRefusGraine} refus={refusGraine} />
      {/if}
    </div>
    {#each REGLAGES as nom (nom)}
      <Champ
        cle={`generation.${nom}`}
        etiquette={`generation.reglage.${nom}`}
        valeur={charge.reglages.generation[nom]}
        lire={lecteur(nom)}
        executer={ecrire(nom)}
      />
    {/each}
  </div>
  {#if mesure === null}
    <p data-duree>{t('generation.duree.inconnue')}</p>
  {:else}
    <p data-duree>{t('generation.duree.observee', mesure)}</p>
    <p data-estimation>{t('generation.duree.estimee', { secondes: estimation.secondes })}</p>
  {/if}
</div>

<style>
  .reglages {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  .champs {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-4);
  }

  .champ {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-1);
  }

  input {
    padding: var(--espace-1) var(--espace-2);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
    background-color: var(--couleur-page-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
  }

  input:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 1px;
  }

  input[aria-invalid='true'] {
    border-color: var(--couleur-refus);
  }

  p {
    margin: 0;
  }
</style>
