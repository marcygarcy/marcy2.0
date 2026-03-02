@echo off
echo Iniciando backend...
cd /d "%~dp0"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --timeout-keep-alive 30 --limit-concurrency 100
pause

