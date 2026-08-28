@echo off
chcp 65001 >nul
setlocal
set "BASH_EXE="

rem 1) 若 git 在 PATH 里，从它的位置推导 bash
for /f "delims=" %%P in ('where git 2^>nul') do (
  if not defined BASH_EXE if exist "%%~dpP..\bin\bash.exe" set "BASH_EXE=%%~dpP..\bin\bash.exe"
)

rem 2) 常见安装位置（含本机的 D:\Git）
if not defined BASH_EXE for %%P in (
  "%ProgramFiles%\Git\bin\bash.exe"
  "%ProgramFiles(x86)%\Git\bin\bash.exe"
  "%LocalAppData%\Programs\Git\bin\bash.exe"
  "D:\Git\bin\bash.exe"
  "C:\Git\bin\bash.exe"
) do if exist "%%~P" set "BASH_EXE=%%~P"

if not defined BASH_EXE (
  echo 未找到 bash.exe：请确认已安装 Git for Windows，
  echo 或用记事本打开本文件，把 D:\Git\bin\bash.exe 改成你的实际安装路径。
  pause
  exit /b 1
)

echo 使用解释器: %BASH_EXE%
"%BASH_EXE%" "%~dp0scripts\deploy-github.sh" %*
pause
