@REM © 2026 TechnoLibre (http://www.technolibre.ca)
@REM License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)
@echo off
rem Lance l'application depuis les sources : scripts\windows\lancer.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\lancer.ps1" %*
exit /b %ERRORLEVEL%
