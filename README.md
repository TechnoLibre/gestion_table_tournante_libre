# Gestion table tournante Libre

Logiciel hors ligne qui place les personnes d'un événement autour de tables et
les fait tourner sur plusieurs tours, pour que chacune rencontre le plus de
monde possible.

## Commandes

| commande | effet |
|---|---|
| `npm install` | installe les outils de construction et d'épreuve |
| `npx playwright install chromium` | télécharge le Chromium des épreuves navigateur, une fois par machine |
| `npm run dev` | sert l'application en développement, sur la plateforme web |
| `npm test` | série `node` : les fonctions pures, à chaque modification |
| `npm run test:long` | épreuves lourdes, avant un commit |
| `npm run test:navigateur` | épreuves de rendu dans Chromium, avant une livraison |
| `npm run build` | construit la page dans `www/` |
| `scripts/construire_windows.sh` | construit l'exécutable Windows portable, sous `podman` |

L'exécutable porte la version datée du logiciel dans son nom, selon le gabarit
`gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe`.

## Licence

© 2026 TechnoLibre. GNU Affero General Public License, version 3 ou ultérieure ;
texte complet dans `LICENSE`.
