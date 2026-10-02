@echo off
cd /d "%~dp0"
echo Gaza 3D GIS Lab V2
echo Open http://127.0.0.1:8080 after the server starts.
start "" http://127.0.0.1:8080
py -m http.server 8080 --bind 127.0.0.1 2>nul || python -m http.server 8080 --bind 127.0.0.1
pause
