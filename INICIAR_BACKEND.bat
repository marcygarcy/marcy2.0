@echo off
cls
echo ========================================
echo    INICIANDO BACKEND API
echo ========================================
echo.
echo Por favor aguarde...
echo.

cd /d "%~dp0backend"

echo Verificando Python...
python --version
echo.

echo Iniciando servidor Uvicorn...
echo Backend estara disponivel em: http://127.0.0.1:8000
echo Documentacao API em: http://127.0.0.1:8000/docs
echo.
echo IMPORTANTE: NAO FECHE ESTA JANELA!
echo.
echo ========================================
echo.

REM --reload: reinicia automaticamente quando alteras ficheiros (nao precisas de fechar e reabrir)
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

pause

