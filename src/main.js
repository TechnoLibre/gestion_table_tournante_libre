// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Point d'entrée de la page : monte l'interface dans le corps du document.
import { mount } from 'svelte';
import App from './interface/App.svelte';

mount(App, { target: document.body });
