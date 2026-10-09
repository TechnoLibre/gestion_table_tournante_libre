# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)
#
# Cibles du projet. Chacune délègue à un script qui porte la logique et se
# lance aussi sans make : ./run.sh, ./install.sh, ./install_dev.sh, et sous
# Windows run.cmd, install.cmd, install_dev.cmd. npm, npx et node passent par
# avec_node, qui pose le Node du projet en tête du PATH après avoir vérifié
# l'installation.
#
#   make            lance l'application, comme ./run.sh
#   make help       la liste des cibles

ifeq ($(OS),Windows_NT)
PS := powershell.exe -NoProfile -ExecutionPolicy Bypass
LANCER := $(PS) -File scripts/windows/lancer.ps1
INSTALLER := $(PS) -File scripts/windows/installer.ps1
INSTALLER_DEV := $(PS) -File scripts/windows/installer.ps1 -Dev
AVEC_NODE := $(PS) -File scripts/windows/avec_node.ps1
else
# bash, où qu'il soit : /bin/bash n'existe pas sous NixOS, et make s'y
# arrêterait avant la première recette.
SHELL := $(shell command -v bash 2>/dev/null || echo /bin/bash)
LANCER := ./run.sh
INSTALLER := ./install.sh
INSTALLER_DEV := ./install_dev.sh
AVEC_NODE := scripts/installation/avec_node.sh
endif

.DEFAULT_GOAL := run

.PHONY: run
run: ## Lance l'application : Electron sur une session graphique, sinon le serveur de Vite
	$(LANCER)

.PHONY: web
web: ## Sert l'application à un navigateur, http://localhost:5173
	$(LANCER) --web

.PHONY: electron
electron: ## Lance la coquille Electron
	$(LANCER) --electron

.PHONY: install
install: ## Installe de quoi lancer l'application et jouer les épreuves sous node
	$(INSTALLER)

.PHONY: install_dev
install_dev: ## Installe aussi Chromium, des polices et podman
	$(INSTALLER_DEV)

.PHONY: test
test: ## Joue la série surveillée, sous node (§ 14.4)
	$(AVEC_NODE) npm test

.PHONY: test_long
test_long: ## Joue la série longue, sous node
	$(AVEC_NODE) npm run test:long

.PHONY: test_navigateur
test_navigateur: ## Joue les épreuves du navigateur, sous Chromium
	$(AVEC_NODE) npm run test:navigateur

.PHONY: test_tout
test_tout: ## Joue les trois séries
	$(AVEC_NODE) npm run test:tout

.PHONY: couverture
couverture: ## Mesure la couverture de la série node, module par module ; seuils durs du § 14.13
	$(AVEC_NODE) npm run couverture

.PHONY: banc
banc: ## Relève les constantes du banc de mesure (§ 19.10), avant une livraison
	$(AVEC_NODE) npm run banc

.PHONY: build
build: ## Construit la page dans www/
	$(AVEC_NODE) npm run build

.PHONY: verifier
verifier: ## Contrôle la version, le nom du livrable et le changelog (§ 18.5)
	$(AVEC_NODE) node scripts/version.js controler

.PHONY: essai_demarrage
essai_demarrage: ## Construit la page et joue une séance par gestes dans Electron, en mode portable
	$(AVEC_NODE) node scripts/essai_demarrage.js

ifeq ($(OS),Windows_NT)
.PHONY: windows
windows: ##W Construit l'exécutable Windows portable (sous Linux seulement, § 16)
	@echo La construction de l'executable se fait sous Linux, en conteneur : make windows.
	@exit 1

.PHONY: clean
clean: ##W Retire la page construite, www/
	$(PS) -Command "Remove-Item -Recurse -Force -ErrorAction SilentlyContinue www"

.PHONY: help
help: ##W Affiche cette liste
	@findstr /R /C:"^[a-z_]*:.*## " /C:"^[a-z_]*:.*##W " Makefile
else
.PHONY: windows
windows: ##U Construit l'exécutable Windows portable, sous podman (§ 16)
	$(AVEC_NODE) scripts/construire_windows.sh

.PHONY: verifier_systemes
verifier_systemes: ##U Installe et éprouve sur chaque système du catalogue, en conteneurs
	scripts/verifier_systemes.sh

.PHONY: clean
clean: ##U Retire la page construite, www/
	rm -rf www

.PHONY: help
help: ##U Affiche cette liste
	@awk 'BEGIN { FS = ":.*##U? " } /^[a-z_]+:.*##U? / { printf "  make %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
endif
