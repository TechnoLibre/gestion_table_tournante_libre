# © 2026 TechnoLibre (http://www.technolibre.ca)
# SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

# Installe sous Windows de quoi lancer l'application depuis les sources et
# jouer les épreuves : Node de la majeure de .node-version, posé sous
# %LOCALAPPDATA% sans droits d'administrateur, et les dépendances de
# package-lock.json. -Dev ajoute le Chromium de Playwright des épreuves du
# navigateur. install.cmd et install_dev.cmd l'appellent.
param([switch]$Dev)
. (Join-Path $PSScriptRoot 'commun.ps1')

Install-GttNode
[void](Enable-GttNode)
Push-Location $script:GttRacine
try {
  Invoke-GttNpmCi
  if ($Dev) {
    Invoke-Gtt 'npx.cmd' @('--no-install', 'playwright', 'install', '--only-shell', 'chromium')
  }
} finally {
  Pop-Location
}
Write-Gtt 'Installation terminée. Lancer : run.cmd'
