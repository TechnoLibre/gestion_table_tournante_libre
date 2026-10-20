@REM © 2026 TechnoLibre (http://www.technolibre.ca)
@REM SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1
@echo off
rem Installe de quoi lancer l'application depuis les sources : scripts\windows\installer.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\installer.ps1" %*
exit /b %ERRORLEVEL%
