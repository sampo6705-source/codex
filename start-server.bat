@echo off
cd /d "%~dp0"
"C:\Users\User\AppData\Local\OpenAI\Codex\bin\node.exe" server.js > server.out.log 2> server.err.log
echo.
echo 伺服器已停止。如果不是你手動關閉，請查看 server.err.log。
pause
