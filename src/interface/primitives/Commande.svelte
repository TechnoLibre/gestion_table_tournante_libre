<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Une commande (§ 2.1, § 8.5) : un bouton dont le libellé est la clé cle,
  // traduite, et qui appelle executer au clic. Avec confirmer, la clé du
  // libellé de confirmation, un premier clic arme la commande — son libellé
  // devient celui de confirmer — et seul un second exécute ; armée, elle se
  // désarme au terme de DELAI_CONFIRMATION_MS, par l'horloge du contexte.
  // La machine est celle de commande.js : le clic répété d'une série
  // — detail supérieur à 1 — est sans effet (§ 8.5). Le clavier n'en porte
  // pas : un appui d'Entrée ou d'Espace que la répétition automatique émet
  // — keydown dont repeat est vrai — voit son action par défaut empêchée, et
  // n'active pas le bouton. Une touche tenue n'active la commande qu'une
  // fois, et ne confirme jamais celle qu'elle vient d'armer.
  //
  // Pendant qu'une exécution qui rend une promesse s'achève, la commande est
  // occupée : un clic ne fait rien, et le bouton porte aria-busy et
  // aria-disabled, dessiné d'un filet tireté. Une exécution sans promesse
  // rend la commande aussitôt.
  //
  // Un refus — une erreur qui porte un code — s'affiche à côté du bouton,
  // avec son remède, et le bouton reste actif : jamais un bouton grisé muet.
  // Une erreur sans code n'est pas un refus et remonte. Le bouton désigne
  // le refus affiché par aria-describedby, sur l'id que porte le refus : le
  // remède qui le retire rend le focus au bouton (Refus).
  //
  // data-commande porte nom, ou à défaut le dernier segment de la clé.
  // nomAccessible, déjà traduit, nomme le bouton quand son libellé seul ne
  // le distingue pas d'un homonyme ; null, le libellé le nomme. Armée, la
  // commande se nomme par son libellé de confirmation, celui qu'elle
  // montre. Le refus reçoit nomAccessible pour nommer son remède.
  // confirmer se lit au montage : une commande qui change de confirmation se
  // remonte.
  //
  // variante : 'secondaire', la défaut, à filet sur le fond de la carte ;
  // 'principale', l'action à faire sur l'écran, pleine de la teinte de
  // l'action, haute d'une cible principale ; 'discrete', sans fond ni filet
  // au repos. Elle ne change que l'apparence ; une variante hors de
  // VARIANTES_COMMANDE lève RangeError au montage.
  import { getContext, onDestroy, untrack } from 'svelte';
  import { effetDe } from '../raccourcis.js';
  import { DELAI_CONFIRMATION_MS, creerMachineCommande, exigerVariante } from './commande.js';
  import Refus from './Refus.svelte';

  let {
    cle,
    executer,
    confirmer = null,
    details = {},
    nom = null,
    nomAccessible = null,
    gestes = {},
    variante = 'secondaire',
  } = $props();

  const t = getContext('t');
  const horloge = getContext('horloge');
  const uid = $props.id();
  const idRefus = `${uid}-refus`;
  const machine = creerMachineCommande({ confirmer: untrack(() => confirmer) });

  let armee = $state(false);
  let enCours = $state(false);
  let refus = $state(null);
  let minuterie = null;

  const libelle = $derived(armee ? t(confirmer) : t(cle, details));
  const designation = $derived(nom ?? cle.slice(cle.lastIndexOf('.') + 1));
  const forme = $derived(exigerVariante(variante));

  function desarmer() {
    if (minuterie === null) return;
    horloge.annuler(minuterie);
    minuterie = null;
  }

  function expirer() {
    minuterie = null;
    machine.expirer();
    armee = machine.armee;
  }

  async function cliquer(evenement) {
    const { action } = machine.cliquer({ repete: evenement.detail > 1 });
    armee = machine.armee;
    if (action === 'aucune') return;
    if (action === 'armer') {
      minuterie = horloge.planifier(expirer, DELAI_CONFIRMATION_MS);
      return;
    }
    desarmer();
    refus = null;
    try {
      const rendu = executer();
      if (typeof rendu?.then === 'function') {
        enCours = true;
        await rendu;
      }
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refus = { code: erreur.code, details: erreur.details ?? {} };
    } finally {
      machine.terminer();
      enCours = false;
    }
  }

  function surTouche(evenement) {
    if (evenement.repeat && effetDe('commande', evenement.key) === 'activer') evenement.preventDefault();
  }

  onDestroy(desarmer);
</script>

<div class="commande">
  <button
    type="button"
    data-commande={designation}
    class:principale={forme === 'principale'}
    class:discrete={forme === 'discrete'}
    aria-busy={enCours ? 'true' : undefined}
    aria-disabled={enCours ? 'true' : undefined}
    aria-label={armee ? undefined : (nomAccessible ?? undefined)}
    aria-describedby={refus === null ? undefined : idRefus}
    onkeydown={surTouche}
    onclick={cliquer}>{libelle}</button
  >
  {#if refus !== null}
    <Refus id={idRefus} {refus} lever={() => (refus = null)} objet={nomAccessible} {gestes} />
  {/if}
</div>

<style>
  .commande {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  /* La secondaire : à filet, sur le fond de la carte. */
  button {
    padding: var(--espace-1) var(--espace-3);
    border: 1px solid var(--couleur-page-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond);
    color: var(--couleur-page-texte);
    font: inherit;
    font-size: var(--taille-texte);
    cursor: pointer;
  }

  button:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  /* La principale : pleine de la teinte de l'action, d'une cible
     principale de haut. */
  button.principale {
    min-height: var(--hauteur-cible);
    padding: 0 var(--espace-4);
    border-color: var(--couleur-action-fond);
    background-color: var(--couleur-action-fond);
    color: var(--couleur-action-texte);
    font-weight: bold;
  }

  /* La discrète : ni fond ni filet au repos ; le survol lui donne le fond
     sourd de la carte. */
  button.discrete {
    border-color: transparent;
    background-color: transparent;
  }

  button.discrete:hover {
    background-color: var(--couleur-carte-fond-sourd);
  }

  button[aria-disabled='true'] {
    border-style: dashed;
    color: var(--couleur-page-texte-secondaire);
    cursor: progress;
  }

  /* Occupée, la principale garde ses couleurs ; son filet tireté prend
     l'encre de son texte. */
  button.principale[aria-disabled='true'] {
    border-color: var(--couleur-action-texte);
    color: var(--couleur-action-texte);
  }

  button:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }
</style>
