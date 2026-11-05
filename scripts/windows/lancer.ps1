# © 2026 TechnoLibre (http://www.technolibre.ca)
# SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

# Lance l'application depuis les sources, sous Windows : la coquille
# Electron charge la page que Vite construit dans www\ (§ 13.1). run.cmd
# l'appelle, ses options sont celles de run.sh.
#
#   run.cmd              Electron
#   run.cmd --web        le serveur de Vite, http://localhost:5173
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Options)
. (Join-Path $PSScriptRoot 'commun.ps1')

$mode = 'electron'
foreach ($option in @($Options | Where-Object { $_ })) {
  switch ($option) {
    '--web' { $mode = 'web' }
    '--electron' { $mode = 'electron' }
    default {
      Write-Gtt 'usage : run.cmd [--web | --electron]'
      exit 2
    }
  }
}

Initialize-Gtt
Push-Location $script:GttRacine
try {
  if ($mode -eq 'web') {
    Write-Gtt "Serveur de développement de Vite : http://localhost:5173 (Ctrl+C pour l'arrêter)."
    & npm.cmd run --silent dev
    exit $LASTEXITCODE
  }
  Invoke-Gtt 'npm.cmd' @('run', '--silent', 'build')
  & npx.cmd --no-install electron .
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
