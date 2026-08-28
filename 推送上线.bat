@echo off
chcp 65001 >nul
bash "%~dp0scripts\deploy-github.sh" %*
pause
