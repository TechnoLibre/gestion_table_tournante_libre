<!-- © 2026 TechnoLibre (http://www.technolibre.ca)
     License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl) -->

<script>
  // Le panneau « À propos » (§ 2.2, § 18.6) : le logo de TechnoLibre,
  // l'éditeur et l'auteur du logiciel, ses liens, puis le bloc d'une ligne
  // que l'opérateur copie dans un courriel, tel que blocAPropos l'a composé,
  // et sa copie dans le presse-papiers de la plateforme ; la licence, ses
  // textes complets à lire sur place, l'attribution, et le sommaire des
  // fonctionnalités. « Copier » remet exactement le texte du bloc, sans
  // l'éditeur ni l'auteur ; l'issue de la copie se lit sous les commandes.
  //
  // Le logo se charge à la demande (actifs/logo.js), au montage : il
  // s'affiche dans un bouton qui ouvre et referme un petit menu de deux
  // commandes, « Télécharger en SVG » et « Télécharger en PNG ». Chacune
  // ferme le menu, rend le focus au logo et remet à facade.enregistrerSous
  // les octets exacts du fichier, sous son nom ; le chemin rendu se dit sous
  // le logo, et un téléchargement du web, qui ne rend pas de chemin, ne dit
  // rien. Échap ferme le menu et rend le focus au logo.
  //
  // Le menu fermé démonte ses commandes avant l'issue de l'enregistrement :
  // le refus — une erreur qui porte un code, comme ECRITURE d'un dossier où
  // rien ne s'écrit — se tient donc dans l'état du panneau, et s'affiche
  // sous le logo, que son aria-describedby désigne. Le téléchargement
  // suivant le retire ; une erreur sans code est une faute, qui remonte.
  //
  // Les liens (LIENS) s'ouvrent dans une nouvelle fenêtre, sans ouvreur ni
  // référent : un nouvel onglet sur le web ; sous electron, la coquille
  // refuse la fenêtre et passe l'adresse au navigateur du système (§ 2).
  //
  // Un texte de licence se charge à la demande (actifs/licences.js) et
  // s'affiche sous les commandes qui l'ouvrent, un seul à la fois ; « Fermer
  // le texte » le retire.
  //
  // Habillage : le titre de l'écran, puis une carte qui porte le logo,
  // l'éditeur, l'auteur en gras et son rôle dans l'encre secondaire, le
  // bloc, sur le fond sourd de la carte, et les commandes — « Copier »,
  // l'action principale, et « Fermer ». Une copie refusée se dit dans
  // l'encre du refus. Suivent les cartes titrées de la licence, de
  // l'attribution et du sommaire, une colonne par catégorie quand la largeur
  // le permet, chaque numéro dans l'encre secondaire devant son intitulé.
  import { getContext, onMount } from 'svelte';
  import { chargerTexteLicence } from '../actifs/licences.js';
  import { FICHIERS_LOGO, chargerLogo } from '../actifs/logo.js';
  import { LIENS, cleDeLien } from './apropos.js';
  import { CATEGORIES, cleDeCategorie, cleDeFonctionnalite } from './fonctionnalites.js';
  import Carte from './primitives/Carte.svelte';
  import Commande from './primitives/Commande.svelte';
  import Refus from './primitives/Refus.svelte';
  import { effetDe } from './raccourcis.js';

  const t = getContext('t');
  const facade = getContext('facade');

  let { bloc, pressePapiers, fermer } = $props();

  const uid = $props.id();
  const idMenuLogo = `${uid}-menu-logo`;
  const idRefusLogo = `${uid}-refus-logo`;

  // null avant toute copie, puis 'faite' ou 'refusee'.
  let issue = $state(null);
  // L'image du logo, une URL data: du SVG, null avant son chargement.
  let image = $state(null);
  let menuLogo = $state(false);
  let boutonLogo = $state(null);
  // Le chemin du dernier logo enregistré, null sans lui.
  let logoEnregistre = $state(null);
  // Le refus du dernier enregistrement du logo : { code, details }, null
  // sans lui.
  let refusLogo = $state(null);
  // Le texte de licence affiché : { nom, contenu }, null sans lui.
  let texteLicence = $state(null);

  onMount(() => {
    chargerLogo().then((logo) => (image = logo.image));
  });

  async function copier() {
    try {
      await pressePapiers.copier(bloc);
      issue = 'faite';
    } catch {
      issue = 'refusee';
    }
  }

  function fermerMenuLogo() {
    menuLogo = false;
    boutonLogo?.focus();
  }

  function toucheLogo(evenement) {
    if (menuLogo && effetDe('menu', evenement.key) === 'fermer') {
      evenement.preventDefault();
      fermerMenuLogo();
    }
  }

  async function telechargerLogo(forme) {
    const octets = (await chargerLogo())[forme];
    fermerMenuLogo();
    logoEnregistre = null;
    refusLogo = null;
    try {
      logoEnregistre = await facade.enregistrerSous(FICHIERS_LOGO[forme], octets);
    } catch (erreur) {
      if (typeof erreur?.code !== 'string') throw erreur;
      refusLogo = { code: erreur.code, details: erreur.details ?? {} };
    }
  }

  async function lireLicence(nom) {
    texteLicence = { nom, contenu: await chargerTexteLicence(nom) };
  }
</script>

{#snippet lien(nom)}
  <a href={LIENS[nom]} target="_blank" rel="noopener noreferrer" data-lien={nom}>{t(cleDeLien(nom))}</a>
{/snippet}

<section class="apropos" data-ecran="apropos">
  <h1>{t('coquille.apropos.titre')}</h1>
  <Carte>
    <div class="contenu">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="logo" onkeydown={toucheLogo}>
        <button
          bind:this={boutonLogo}
          type="button"
          class="bouton-logo"
          data-commande="logo"
          aria-label={t('coquille.apropos.logo.menu')}
          aria-expanded={menuLogo ? 'true' : 'false'}
          aria-controls={idMenuLogo}
          aria-describedby={refusLogo === null ? undefined : idRefusLogo}
          onclick={() => (menuLogo = !menuLogo)}
        >
          {#if image !== null}
            <img src={image} alt="" width="250" height="50" />
          {/if}
        </button>
        <div class="menu-logo" id={idMenuLogo} hidden={!menuLogo}>
          {#if menuLogo}
            <Commande cle="coquille.apropos.logo.telechargerSvg" executer={() => telechargerLogo('svg')} />
            <Commande cle="coquille.apropos.logo.telechargerPng" executer={() => telechargerLogo('png')} />
          {/if}
        </div>
        {#if logoEnregistre !== null}
          <p role="status" class="enregistre" data-logo-enregistre>
            {t('coquille.apropos.logo.enregistre', { chemin: logoEnregistre })}
          </p>
        {/if}
        {#if refusLogo !== null}
          <Refus id={idRefusLogo} refus={refusLogo} lever={() => (refusLogo = null)} />
        {/if}
      </div>
      <div class="credits" data-credits>
        <p data-editeur>{t('coquille.apropos.editeur')}</p>
        <p>{@render lien('site')}</p>
        <p class="auteur" data-auteur>{t('coquille.apropos.auteur')}</p>
        <p class="role" data-role>{t('coquille.apropos.role')}</p>
        <p>{@render lien('projet')}</p>
        <p class="note">{t('coquille.apropos.liens.note')}</p>
      </div>
      <p class="bloc" data-bloc>{bloc}</p>
      <div class="commandes">
        <Commande cle="coquille.apropos.copier" nom="copier" variante="principale" executer={copier} />
        <Commande cle="coquille.apropos.fermer" nom="fermerApropos" executer={fermer} />
      </div>
      {#if issue === 'faite'}
        <p role="status">{t('coquille.apropos.copie')}</p>
      {:else if issue === 'refusee'}
        <p role="status" class="refus" data-refus="copier">{t('coquille.apropos.copieRefusee')}</p>
      {/if}
    </div>
  </Carte>

  <Carte titre={t('coquille.apropos.licence.titre')}>
    <div class="contenu">
      <p>{t('coquille.apropos.licence.choix')}</p>
      <ul>
        <li>{t('coquille.apropos.licence.agpl')}</li>
        <li>{t('coquille.apropos.licence.liliq')}</li>
      </ul>
      <p>{t('coquille.apropos.licence.spdx')} <code>{t('coquille.apropos.licence.spdxValeur')}</code></p>
      <p>{t('coquille.apropos.licence.textes')}</p>
      <p>{t('coquille.apropos.licence.respecter')}</p>
      <ul>
        <li>{t('coquille.apropos.licence.obligation1')}</li>
        <li>{t('coquille.apropos.licence.obligation2')}</li>
        <li>{t('coquille.apropos.licence.obligation3')}</li>
        <li>{t('coquille.apropos.licence.obligation4')}</li>
        <li>{t('coquille.apropos.licence.obligation5')}</li>
      </ul>
      <p>{t('coquille.apropos.licence.contributions')}</p>
      <p class="liens">{@render lien('agpl')}{@render lien('liliq')}</p>
      <div class="commandes">
        <Commande cle="coquille.apropos.licence.lireAgpl" executer={() => lireLicence('agpl')} />
        <Commande cle="coquille.apropos.licence.lireLiliq" executer={() => lireLicence('liliq')} />
        {#if texteLicence !== null}
          <Commande cle="coquille.apropos.licence.fermerTexte" executer={() => (texteLicence = null)} />
        {/if}
      </div>
      {#if texteLicence !== null}
        <pre class="texte-licence" data-texte-licence={texteLicence.nom}>{texteLicence.contenu}</pre>
      {/if}
    </div>
  </Carte>

  <Carte titre={t('coquille.apropos.attribution.titre')}>
    <p>{t('coquille.apropos.attribution.texte')}</p>
  </Carte>

  <Carte titre={t('coquille.apropos.fonctionnalites.titre')} sousTitre={t('coquille.apropos.fonctionnalites.explication')}>
    <div class="sommaire">
      {#each CATEGORIES as { code, fonctionnalites } (code)}
        <div class="categorie" data-categorie={code}>
          <h3>{t(cleDeCategorie(code))}</h3>
          <ul>
            {#each fonctionnalites as { numero } (numero)}
              <li data-fonctionnalite={numero}>
                <span class="numero">{t('coquille.apropos.numeroFonctionnalite', { numero })}</span>
                <span>{t(cleDeFonctionnalite(numero))}</span>
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  </Carte>
</section>

<style>
  .apropos {
    display: flex;
    flex-direction: column;
    gap: var(--espace-4);
  }

  h1 {
    margin: 0;
  }

  h3 {
    margin: 0;
    font-size: var(--taille-texte);
  }

  .contenu {
    display: flex;
    flex-direction: column;
    gap: var(--espace-3);
  }

  p,
  ul {
    margin: 0;
  }

  ul {
    padding-left: var(--espace-5);
  }

  /* Le logo, à sa taille d'origine ou à la largeur de la carte quand elle
     est moindre, garde sa place avant d'être chargé ; son menu se pose
     dessous. */
  .logo {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--espace-2);
  }

  .bouton-logo {
    display: block;
    width: min(15.625rem, 100%);
    aspect-ratio: 5;
    padding: 0;
    border: 0;
    border-radius: var(--rayon-2);
    background: none;
    cursor: pointer;
  }

  .bouton-logo img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: var(--rayon-2);
  }

  .bouton-logo:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--couleur-focus);
    outline-offset: 2px;
  }

  .menu-logo:not([hidden]) {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2);
  }

  .credits {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
  }

  .auteur {
    font-weight: bold;
  }

  .role,
  .note,
  .numero {
    color: var(--couleur-page-texte-secondaire);
  }

  .note {
    font-size: var(--taille-texte-petit);
  }

  /* Un lien porte l'encre de l'action, souligné : il se distingue du texte
     sans la couleur. */
  a {
    color: var(--couleur-action-encre);
    text-decoration-line: underline;
    text-underline-offset: 0.2em;
    overflow-wrap: anywhere;
  }

  .liens {
    display: flex;
    flex-wrap: wrap;
    gap: var(--espace-2) var(--espace-4);
  }

  /* Le bloc se sélectionne d'un clic, entier, et se coupe où il faut
     plutôt que de déborder. */
  .bloc {
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
    font-variant-numeric: tabular-nums;
    user-select: all;
    overflow-wrap: anywhere;
  }

  .commandes {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--espace-2);
  }

  .refus {
    color: var(--couleur-refus);
  }

  code {
    font: inherit;
    font-weight: bold;
  }

  /* Un texte de licence garde ses lignes et ses alignements, et se coupe à
     la largeur de la carte plutôt que de déborder. */
  .texte-licence {
    margin: 0;
    padding: var(--espace-3) var(--espace-4);
    border: 1px solid var(--couleur-carte-filet);
    border-radius: var(--rayon-2);
    background-color: var(--couleur-carte-fond-sourd);
    font: inherit;
    font-size: var(--taille-texte-petit);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .sommaire {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
    gap: var(--espace-4);
  }

  .categorie {
    display: flex;
    flex-direction: column;
    gap: var(--espace-2);
  }

  .categorie ul {
    display: flex;
    flex-direction: column;
    gap: var(--espace-1);
    padding: 0;
    list-style: none;
  }

  .numero {
    font-weight: bold;
    font-variant-numeric: tabular-nums;
  }
</style>
