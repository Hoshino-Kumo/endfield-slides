@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul && (python tools\serve.py & goto :end)
where py >nul 2>nul && (py tools\serve.py & goto :end)
echo 请先安装 Python 3，并将 Python 添加到 PATH。
:end
pause
