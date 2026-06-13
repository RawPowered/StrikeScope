@echo off
title StrikeScope Launcher
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0launcher.ps1"
if errorlevel 1 pause
