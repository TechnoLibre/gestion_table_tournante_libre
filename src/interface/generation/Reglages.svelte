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
  //
  // Les quatre contraintes et l'attribution des sièges (§ 5.3) sont des
  // cases à cocher, chacune sous son nom du spec : un clic, ou la barre
  // d'espace, exécute modifierReglage {cle, valeur} — une entrée par
  // bascule. À l'issue du geste, la case montre la valeur de la charge,
  // écrite ou inchangée. Un refus de la séance — lecture, plan
  // bloqué, support rompu — se pose à côté de la case, avec son remède, et
  // rien ne s'écrit.
  //
  // Les cœurs de calcul sont un réglage du poste, que le contrôleur de
  // génération tient pour la séance du logiciel : ni le fichier ni le journal
  // ne les portent, et ils se règlent en lecture comme en écriture. La case
  // « Cœurs automatiques », cochée par défaut, emploie un cœur par
  // processeur logique ; décochée, elle montre « Nombre de cœurs », pré-rempli
  // du dernier nombre accepté. La saisie se valide à la sortie du champ ou
  // par Entrée, par controleur.reglerCoeurs ; son refus se pose contre le
  // champ, saisie gardée, et le parent le lit (refusCoeurs, lié) : un refus
  // posé, « Générer » ne part pas. Échap rend le dernier nombre accepté. La
  // valeur automatique du poste s'affiche à côté, dans les deux états.
  import { getContext, untrack } from 'svelte';
  import Champ from '../primitives/Champ.svelte';
  import Refus from '../primitives/Refus.svelte';

  let {
    charge,
    mesure,
    estimation,
    graine = $bindable(),
    refusGraine = null,
    saisirGraine,
    refusCoeurs = $bindable(null),
  } = $props();

  const t = getContext('t');
  const seance = getContext('seance');
  const generation = getContext('generation');
  const uid = $props.id();
  const idGraine = `${uid}-graine`;
  const idRefusGraine = `${uid}-graine-refus`;
  const idCoeursAutomatiques = `${uid}-coeurs-automatiques`;
  const idCoeurs = `${uid}-coeurs`;
  const idRefusCoeurs = `${uid}-coeurs-refus`;

  // Le réglage des cœurs, tel que le contrôleur le publie, et le texte du
  // champ « Nombre de cœurs ».
  const coeurs = $derived($generation.coeurs);
  let saisieCoeurs = $state(untrack(() => String(generation.coeurs().manuel)));

  // Rend au champ le dernier nombre accepté, sans refus.
  function rendreCoeurs() {
    saisieCoeurs = String(generation.coeurs().manuel);
    refusCoeurs = null;
  }

  function basculerCoeurs(evenement) {
    generation.reglerCoeurs({ automatique: evenement.currentTarget.checked });
    rendreCoeurs();
  }

  function validerCoeurs() {
    refusCoeurs = generation.reglerCoeurs({ saisie: saisieCoeurs }).refus;
  }

  function toucheCoeurs(evenement) {
    if (evenement.key === 'Escape') rendreCoeurs();
    else if (evenement.key === 'Enter') {
      evenement.preventDefault();
      validerCoeurs();
    }
  }

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

  // Les bascules, dans l'ordre du § 5.3 : la clé du réglage et celle de son
  // libellé.
  const BASCULES = [
    { cle: 'separerAppartenances', etiquette: 'generation.contrainte.separerAppartenances' },
    { cle: 'nouveauxVoisins', etiquette: 'generation.contrainte.nouveauxVoisins' },
    { cle: 'nouvelleTable', etiquette: 'generation.contrainte.nouvelleTable' },
    { cle: 'varierAppartenances', etiquette: 'generation.contrainte.varierAppartenances' },
    { cle: 'attribuerSieges', etiquette: 'generation.contrainte.attribuerSieges' },
  ];

  // Le refus de la dernière bascule, { cle, refus }, posé à côté d'elle.
  let refusBascule = $state.raw(null);

  // Le clic sur une case : la séance écrit la valeur contraire de celle de
  // la charge ; à l'issue, la case montre celle de la charge, écrite ou
  // inchangée. Annuler le clic ne suffirait pas : la séance peut avoir écrit
  // avant que le navigateur rétablisse la case, à la fin de l'événement.
  async function basculer(evenement, cle) {
    const caseACocher = evenement.currentTarget;
    refusBascule = null;
    try {
      await seance.executer('modifierReglage', { cle, valeur: !charge.reglages[cle] });
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusBascule = { cle, refus: { code: erreur.code, details: erreur.details ?? {} } };
    } finally {
      caseACocher.checked = charge.reglages[cle];
    }
  }
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
  <fieldset class="bascules">
    <legend>{t('generation.contraintes.titre')}</legend>
    {#each BASCULES as { cle, etiquette } (cle)}
      <div class="bascule">
        <input
          id={`${uid}-${cle}`}
          type="checkbox"
          data-champ={cle}
          checked={charge.reglages[cle]}
          onclick={(evenement) => basculer(evenement, cle)}
        />
        <label for={`${uid}-${cle}`}>{t(etiquette)}</label>
        {#if refusBascule !== null && refusBascule.cle === cle}
          <Refus refus={refusBascule.refus} lever={() => (refusBascule = null)} />
        {/if}
      </div>
    {/each}
  </fieldset>
  <fieldset class="coeurs" data-coeurs>
    <legend>{t('generation.coeurs.titre')}</legend>
    <div class="bascule">
      <input
        id={idCoeursAutomatiques}
        type="checkbox"
        data-champ="coeursAutomatiques"
        checked={coeurs.automatique}
        onchange={basculerCoeurs}
      />
      <label for={idCoeursAutomatiques}>{t('generation.coeurs.automatique')}</label>
    </div>
    {#if !coeurs.automatique}
      <div class="champ">
        <label for={idCoeurs}>{t('generation.coeurs.nombre', { disponibles: coeurs.disponibles })}</label>
        <input
          id={idCoeurs}
          type="text"
          inputmode="numeric"
          data-champ="coeurs"
          bind:value={saisieCoeurs}
          aria-invalid={refusCoeurs === null ? undefined : 'true'}
          aria-describedby={refusCoeurs === null ? undefined : idRefusCoeurs}
          oninput={() => (refusCoeurs = null)}
          onkeydown={toucheCoeurs}
          onblur={validerCoeurs}
        />
        {#if refusCoeurs !== null}
          <Refus id={idRefusCoeurs} refus={refusCoeurs} />
        {/if}
      </div>
    {/if}
    <p data-coeurs-disponibles>{t('generation.coeurs.disponibles', { disponibles: coeurs.disponibles })}</p>
    <p>{t('generation.coeurs.note')}</p>
  </fieldset>
  {#if mesure === null}
    <p data-duree>{t('generation.duree.inconnue')}</p>
  {:else}
    <p data-duree>{t('generation.duree.observee', mesure)}</p>
    <p data-estimation>{t('generation.duree.estimee', estimation)}</p>
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

  .coeurs {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
    margin: 0;
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
  }

  .bascules {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2) var(--espace-4);
    margin: 0;
    padding: var(--espace-2) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-1);
  }

  legend {
    padding: 0 var(--espace-1);
  }

  .bascule {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-1);
  }

  .bascule input {
    margin: 0;
  }

  p {
    margin: 0;
  }
</style>
