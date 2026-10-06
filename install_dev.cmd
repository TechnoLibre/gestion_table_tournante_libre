@REM © 2026 TechnoLibre (http://www.technolibre.ca)
@REM License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)
@echo off
rem Installe l'environnement de developpement : scripts\windows\installer.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\installer.ps1" -Dev %*
exit /b %ERRORLEVEL%
