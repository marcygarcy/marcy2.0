@echo off
title Abrir aplicacao
cd /d "%~dp0"

REM Tenta abrir no browser (usa a porta que costuma estar livre)
start "" "http://localhost:3003"
timeout /t 1 /nobreak >nul
start "" "http://localhost:3000"
timeout /t 1 /nobreak >nul
start "" "http://localhost:3001"
echo.
echo Abri o browser em varias portas.
echo Use a que mostrar a aplicacao (3003, 3000 ou 3001).
echo Backend: http://localhost:8000
echo.
pause
